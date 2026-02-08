#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ISTIO_VERSION="1.28.3"
PROFILE="${1:-kind}"

# Always download the pinned istioctl version to avoid using a stale system copy
echo "==> Downloading istioctl ${ISTIO_VERSION}..."
curl -sL https://istio.io/downloadIstio | ISTIO_VERSION="$ISTIO_VERSION" sh -
export PATH="$PWD/istio-${ISTIO_VERSION}/bin:$PATH"

echo "==> Installing Istio (profile: ${PROFILE})..."
if [ "$PROFILE" = "kind" ]; then
  istioctl install -f "$PROJECT_DIR/k8s/base/istio/istio-operator-kind.yaml" -y
elif [ "$PROFILE" = "production" ]; then
  istioctl install -f "$PROJECT_DIR/k8s/base/istio/istio-operator-production.yaml" -y
else
  echo "Unknown profile: $PROFILE (use 'kind' or 'production')"
  exit 1
fi

# Label the blog namespace for sidecar injection
kubectl label namespace blog istio-injection=enabled --overwrite 2>/dev/null || true

echo "==> Waiting for Istio pods to be ready..."
kubectl wait --namespace istio-system \
  --for=condition=ready pod \
  --all \
  --timeout=120s

echo "==> Istio installed successfully"
istioctl version
