#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

VAULT_POD="vault-0"
VAULT_NS="vault"

vault_exec() {
  kubectl exec -n "$VAULT_NS" "$VAULT_POD" -- vault "$@"
}

# Generate an NKey pair using the nats-box Docker image (has nk preinstalled).
# nk -gen user outputs only the seed; -pubout extracts the public key from it.
generate_nkey() {
  docker run --rm natsio/nats-box:latest sh -c \
    'SEED=$(nk -gen user) && echo "$SEED" > /tmp/seed.nk && echo "$SEED" && nk -inkey /tmp/seed.nk -pubout'
}

SERVICES=("user-service" "post-service" "comment-service" "notification-service" "search-indexer" "media-service")

echo "==> Generating NATS NKey pairs and storing in Vault..."

declare -A PUBKEYS

for svc in "${SERVICES[@]}"; do
  echo "    Generating NKey for $svc..."
  KEYPAIR=$(generate_nkey)
  SEED=$(echo "$KEYPAIR" | head -1)
  PUBKEY=$(echo "$KEYPAIR" | tail -1)

  if [[ ! "$SEED" =~ ^SU ]]; then
    echo "ERROR: Expected seed starting with SU, got: $SEED" >&2
    exit 1
  fi
  if [[ ! "$PUBKEY" =~ ^U ]]; then
    echo "ERROR: Expected public key starting with U, got: $PUBKEY" >&2
    exit 1
  fi

  PUBKEYS[$svc]="$PUBKEY"

  vault_exec kv put "secret/blog/nats/$svc" \
    NATS_NKEY_SEED="$SEED"
done

echo "==> Patching NATS ConfigMap with public keys..."

NATS_CONF_FILE="$PROJECT_DIR/k8s/base/nats/deployment.yaml"

# Replace the nkey value for each service by matching the comment above it.
# This is idempotent — works whether the value is a placeholder or a previous key.
for svc in "${SERVICES[@]}"; do
  pubkey="${PUBKEYS[$svc]}"
  sed -i "/# $svc/{n;s/nkey: \"[^\"]*\"/nkey: \"$pubkey\"/}" "$NATS_CONF_FILE"
done

echo ""
echo "==> NKey public keys:"
for svc in "${SERVICES[@]}"; do
  echo "    $svc: ${PUBKEYS[$svc]}"
done
echo ""
echo "==> Seeds stored in Vault at secret/blog/nats/<service>"
echo "==> NATS ConfigMap patched with public keys"
echo "==> NKey generation complete"
