use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
    Json,
};
use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use serde_json::json;
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;

type RateLimiterType = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

#[derive(Clone)]
pub struct RateLimitState {
    pub limiter: Arc<RateLimiterType>,
    pub trusted_proxies: Vec<IpAddr>,
}

impl RateLimitState {
    pub fn new(per_minute: u32, trusted_proxies: Vec<IpAddr>) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(per_minute).unwrap());
        let limiter = Arc::new(RateLimiter::dashmap(quota));
        Self {
            limiter,
            trusted_proxies,
        }
    }
}

/// Extract the real client IP for rate-limiting.
///
/// - When `trusted_proxies` is empty (default), uses the socket peer address
///   and ignores `X-Forwarded-For` entirely. This prevents clients from
///   spoofing their IP to bypass rate limits.
/// - When `trusted_proxies` is configured AND the direct peer is in that list,
///   walks `X-Forwarded-For` right-to-left, skipping trusted entries, and
///   returns the rightmost untrusted IP.
/// - Falls back to the socket peer if XFF is absent or fully trusted.
fn extract_client_ip(request: &Request, trusted_proxies: &[IpAddr]) -> String {
    let peer_ip = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip());

    // No trusted proxies configured — use socket address, ignore XFF.
    if trusted_proxies.is_empty() {
        return peer_ip
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "unknown".to_string());
    }

    // Only consult XFF if the direct peer is a trusted proxy.
    let peer = match peer_ip {
        Some(ip) if trusted_proxies.contains(&ip) => ip,
        Some(ip) => return ip.to_string(),
        None => return "unknown".to_string(),
    };

    // Walk XFF right-to-left: the rightmost untrusted IP is the client.
    if let Some(xff) = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
    {
        let addrs: Vec<&str> = xff.split(',').map(|s| s.trim()).collect();
        for addr in addrs.iter().rev() {
            if let Ok(ip) = addr.parse::<IpAddr>() {
                if !trusted_proxies.contains(&ip) {
                    return ip.to_string();
                }
            } else {
                // Unparseable XFF entry — stop here, use peer.
                break;
            }
        }
    }

    // All XFF entries were trusted or XFF was absent — use peer IP.
    peer.to_string()
}

pub async fn rate_limit(
    state: RateLimitState,
    request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let key = extract_client_ip(&request, &state.trusted_proxies);

    match state.limiter.check_key(&key) {
        Ok(_) => Ok(next.run(request).await),
        Err(_) => Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Rate limit exceeded. Try again later."})),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request as HttpRequest;

    fn mock_request(
        peer: Option<SocketAddr>,
        xff: Option<&str>,
    ) -> Request {
        let mut builder = HttpRequest::builder().uri("/test");
        if let Some(val) = xff {
            builder = builder.header("x-forwarded-for", val);
        }
        let mut req = builder.body(axum::body::Body::empty()).unwrap();
        if let Some(addr) = peer {
            req.extensions_mut().insert(ConnectInfo(addr));
        }
        req
    }

    fn addr(s: &str) -> SocketAddr {
        s.parse().unwrap()
    }

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    // --- No trusted proxies (default) ---

    #[test]
    fn no_proxies_uses_socket_addr() {
        let req = mock_request(Some(addr("192.168.1.50:12345")), None);
        assert_eq!(extract_client_ip(&req, &[]), "192.168.1.50");
    }

    #[test]
    fn no_proxies_ignores_xff() {
        let req = mock_request(
            Some(addr("192.168.1.50:12345")),
            Some("10.0.0.1"),
        );
        assert_eq!(extract_client_ip(&req, &[]), "192.168.1.50");
    }

    #[test]
    fn no_proxies_spoofed_xff_ignored() {
        let req = mock_request(
            Some(addr("192.168.1.50:12345")),
            Some("1.2.3.4, 5.6.7.8"),
        );
        assert_eq!(extract_client_ip(&req, &[]), "192.168.1.50");
    }

    #[test]
    fn no_proxies_no_connect_info_returns_unknown() {
        let req = mock_request(None, Some("1.2.3.4"));
        assert_eq!(extract_client_ip(&req, &[]), "unknown");
    }

    // --- With trusted proxies ---

    #[test]
    fn trusted_proxy_extracts_client_from_xff() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("203.0.113.50"),
        );
        assert_eq!(extract_client_ip(&req, &trusted), "203.0.113.50");
    }

    #[test]
    fn trusted_proxy_chain_walks_right_to_left() {
        let trusted = vec![ip("10.0.0.1"), ip("10.0.0.2")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("203.0.113.50, 10.0.0.2"),
        );
        assert_eq!(extract_client_ip(&req, &trusted), "203.0.113.50");
    }

    #[test]
    fn untrusted_peer_ignores_xff_even_with_trusted_configured() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(
            Some(addr("192.168.1.50:12345")),
            Some("1.2.3.4"),
        );
        // Peer 192.168.1.50 is not trusted, so XFF is ignored.
        assert_eq!(extract_client_ip(&req, &trusted), "192.168.1.50");
    }

    #[test]
    fn trusted_proxy_no_xff_falls_back_to_peer() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(Some(addr("10.0.0.1:54321")), None);
        assert_eq!(extract_client_ip(&req, &trusted), "10.0.0.1");
    }

    #[test]
    fn trusted_proxy_all_xff_trusted_falls_back_to_peer() {
        let trusted = vec![ip("10.0.0.1"), ip("10.0.0.2")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("10.0.0.2"),
        );
        assert_eq!(extract_client_ip(&req, &trusted), "10.0.0.1");
    }

    #[test]
    fn trusted_proxy_empty_xff_falls_back_to_peer() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(Some(addr("10.0.0.1:54321")), Some(""));
        assert_eq!(extract_client_ip(&req, &trusted), "10.0.0.1");
    }

    #[test]
    fn trusted_proxy_garbage_xff_entry_falls_back_to_peer() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("not-an-ip, 203.0.113.50"),
        );
        // Walking right-to-left: 203.0.113.50 is untrusted → use it.
        assert_eq!(extract_client_ip(&req, &trusted), "203.0.113.50");
    }

    #[test]
    fn trusted_proxy_garbage_only_xff_falls_back_to_peer() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("not-an-ip"),
        );
        // Unparseable → break, use peer.
        assert_eq!(extract_client_ip(&req, &trusted), "10.0.0.1");
    }

    #[test]
    fn no_connect_info_with_trusted_returns_unknown() {
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(None, Some("203.0.113.50"));
        assert_eq!(extract_client_ip(&req, &trusted), "unknown");
    }

    // --- Spoofing attack scenarios ---

    #[test]
    fn spoof_xff_with_no_trusted_proxies_has_no_effect() {
        // Attacker sends fake XFF to get a different rate-limit bucket.
        // Without trusted proxies, XFF is ignored entirely.
        let req = mock_request(
            Some(addr("192.168.1.100:9999")),
            Some("1.1.1.1, 2.2.2.2, 3.3.3.3"),
        );
        assert_eq!(extract_client_ip(&req, &[]), "192.168.1.100");
    }

    #[test]
    fn spoof_xff_prepend_attack_with_trusted_proxy() {
        // Attacker prepends a fake IP to XFF. The real proxy appends
        // the actual client IP. We walk right-to-left: the proxy-appended
        // (rightmost untrusted) IP is used, not the attacker-prepended one.
        let trusted = vec![ip("10.0.0.1")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("9.9.9.9, 203.0.113.50"),
        );
        assert_eq!(extract_client_ip(&req, &trusted), "203.0.113.50");
    }

    #[test]
    fn spoof_xff_inject_trusted_ip_attack() {
        // Attacker tries to inject a trusted proxy IP into XFF to make
        // their real IP appear further left (and get skipped). Walking
        // right-to-left, we skip the injected trusted IP and find the
        // actual client IP.
        let trusted = vec![ip("10.0.0.1"), ip("10.0.0.2")];
        let req = mock_request(
            Some(addr("10.0.0.1:54321")),
            Some("9.9.9.9, 203.0.113.50, 10.0.0.2"),
        );
        // 10.0.0.2 trusted (skip) → 203.0.113.50 untrusted → use it.
        assert_eq!(extract_client_ip(&req, &trusted), "203.0.113.50");
    }

    #[test]
    fn ipv6_peer_works() {
        let req = mock_request(Some(addr("[::1]:12345")), None);
        assert_eq!(extract_client_ip(&req, &[]), "::1");
    }

    #[test]
    fn ipv6_trusted_proxy_with_xff() {
        let trusted = vec![ip("::1")];
        let req = mock_request(
            Some(addr("[::1]:12345")),
            Some("2001:db8::1"),
        );
        assert_eq!(extract_client_ip(&req, &trusted), "2001:db8::1");
    }
}
