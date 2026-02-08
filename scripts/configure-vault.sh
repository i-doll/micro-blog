#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

VAULT_POD="vault-0"
VAULT_NS="vault"
PHASE="${1:-all}"

vault_exec() {
  kubectl exec -n "$VAULT_NS" "$VAULT_POD" -- vault "$@"
}

configure_secrets_and_auth() {
  echo "==> Configuring Vault KV secrets..."

  POSTGRES_PASSWORD=$(openssl rand -base64 24)
  CAPTCHA_SECRET=$(openssl rand -hex 32)
  ADMIN_PASSWORD=$(openssl rand -base64 16)

  # Generate RSA 2048-bit keypair for RS256 JWT signing
  RSA_PRIVATE_KEY=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null)

  vault_exec kv put secret/blog/shared \
    CAPTCHA_SECRET="$CAPTCHA_SECRET"

  # Store RSA private key separately for auth-service
  vault_exec kv put secret/blog/rsa-key \
    RSA_PRIVATE_KEY="$RSA_PRIVATE_KEY"

  vault_exec kv put secret/blog/admin \
    ADMIN_EMAIL=admin@blog.local \
    ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    ADMIN_USERNAME=admin

  vault_exec kv put secret/blog/postgres \
    POSTGRES_PASSWORD="$POSTGRES_PASSWORD"

  # Persist postgres password for the DB engine phase
  kubectl create configmap vault-setup-state \
    --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -n "$VAULT_NS" --dry-run=client -o yaml | kubectl apply -f -

  echo "==> Enabling Kubernetes auth method..."
  vault_exec auth enable kubernetes 2>/dev/null || true
  vault_exec write auth/kubernetes/config \
    kubernetes_host="https://kubernetes.default.svc:443"

  echo "==> Enabling database secrets engine..."
  vault_exec secrets enable database 2>/dev/null || true

  echo "==> Writing Vault policies..."
  for policy_file in "$PROJECT_DIR"/k8s/base/vault/policies/*.hcl; do
    policy_name="$(basename "$policy_file" .hcl)-policy"
    kubectl cp "$policy_file" "$VAULT_NS/$VAULT_POD:/tmp/$(basename "$policy_file")"
    vault_exec policy write "$policy_name" "/tmp/$(basename "$policy_file")"
  done

  echo "==> Configuring Kubernetes auth roles..."

  declare -A SERVICE_POLICIES=(
    ["gateway"]="gateway-policy"
    ["auth-service"]="auth-service-policy"
    ["user-service"]="user-service-policy"
    ["post-service"]="post-service-policy"
    ["comment-service"]="comment-service-policy"
    ["notification-service"]="notification-service-policy"
    ["search-indexer"]="search-service-policy"
    ["search-query"]="search-service-policy"
    ["media-service"]="media-service-policy"
    ["captcha-service"]="captcha-service-policy"
    ["postgres"]="postgres-policy"
  )

  for sa in "${!SERVICE_POLICIES[@]}"; do
    vault_exec write "auth/kubernetes/role/$sa" \
      bound_service_account_names="$sa" \
      bound_service_account_namespaces=blog \
      policies="${SERVICE_POLICIES[$sa]}" \
      ttl=1h
  done

  echo "==> Vault secrets and auth configured"
}

configure_database_engine() {
  echo "==> Configuring Vault database secrets engine..."

  # Retrieve the postgres password stored during the secrets phase
  POSTGRES_PASSWORD=$(kubectl get configmap vault-setup-state -n "$VAULT_NS" \
    -o jsonpath='{.data.POSTGRES_PASSWORD}')

  echo "    Waiting for postgres to be ready..."
  kubectl wait --namespace blog \
    --for=condition=ready pod \
    --selector=app=postgres \
    --timeout=120s

  declare -A SERVICE_DBS=(
    ["auth-service"]="blog_auth"
    ["user-service"]="blog_users"
    ["post-service"]="blog_posts"
    ["comment-service"]="blog_comments"
    ["notification-service"]="blog_notifications"
    ["media-service"]="blog_media"
  )

  # Create a separate Vault database config per service database so that
  # GRANT statements execute in the correct database context.
  for svc in "${!SERVICE_DBS[@]}"; do
    db="${SERVICE_DBS[$svc]}"
    echo "    Configuring database connection for $svc ($db)..."
    vault_exec write "database/config/$svc-db" \
      plugin_name=postgresql-database-plugin \
      allowed_roles="$svc" \
      connection_url="postgresql://{{username}}:{{password}}@postgres.blog.svc:5432/$db?sslmode=disable" \
      username=postgres \
      password="$POSTGRES_PASSWORD"

    vault_exec write "database/roles/$svc" \
      db_name="$svc-db" \
      creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT ALL PRIVILEGES ON DATABASE $db TO \"{{name}}\"; \
        GRANT ALL ON SCHEMA public TO \"{{name}}\"; \
        GRANT ALL ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"{{name}}\";" \
      revocation_statements="REASSIGN OWNED BY \"{{name}}\" TO postgres; DROP OWNED BY \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
      default_ttl=1h \
      max_ttl=24h
  done

  echo "==> Database secrets engine configured for all services"
}

case "$PHASE" in
  secrets)
    configure_secrets_and_auth
    ;;
  database)
    configure_database_engine
    ;;
  all)
    configure_secrets_and_auth
    configure_database_engine
    ;;
  *)
    echo "Usage: $0 {secrets|database|all}"
    exit 1
    ;;
esac
