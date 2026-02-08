use chrono::{Duration, Utc};
use jsonwebtoken::{
    decode, encode, jwk::JwkSet, Algorithm, DecodingKey, EncodingKey, Header, Validation,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub username: String,
    pub role: String,
    pub exp: i64,
    pub iat: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
}

impl Claims {
    pub fn new(user_id: Uuid, username: String, role: String, expiry_hours: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            username,
            role,
            iat: now.timestamp(),
            exp: (now + Duration::hours(expiry_hours)).timestamp(),
            iss: None,
        }
    }
}

pub fn encode_jwt(claims: &Claims, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn decode_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

/// Decode and validate an RS256 JWT using a JWKS document.
/// Matches the token's `kid` header against keys in the JWKS.
pub fn decode_jwt_rs256(
    token: &str,
    jwks: &JwkSet,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    let header = jsonwebtoken::decode_header(token)?;
    let kid = header.kid.as_deref();

    let jwk = if let Some(kid) = kid {
        jwks.find(kid)
    } else {
        // Fall back to the first RS256 key if no kid in token
        jwks.keys.first()
    };

    let jwk = jwk.ok_or_else(|| {
        jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidKeyFormat)
    })?;

    let decoding_key = DecodingKey::from_jwk(jwk)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    validation.set_issuer(&["blog-auth"]);
    let token_data = decode::<Claims>(token, &decoding_key, &validation)?;
    Ok(token_data.claims)
}
