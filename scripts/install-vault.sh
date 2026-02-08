#!/usr/bin/env bash
set -euo pipefail

echo "==> Adding HashiCorp Helm repo..."
helm repo add hashicorp https://helm.releases.hashicorp.com 2>/dev/null || true
helm repo update hashicorp

echo "==> Installing Vault (dev mode)..."
helm upgrade --install vault hashicorp/vault \
  --namespace vault --create-namespace \
  --set "server.dev.enabled=true" \
  --set "server.dev.devRootToken=root" \
  --set "injector.enabled=false" \
  --wait --timeout 120s

echo "==> Waiting for Vault pod to be ready..."
kubectl wait --namespace vault \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=vault \
  --timeout=120s

echo "==> Installing Vault Secrets Operator..."
helm upgrade --install vault-secrets-operator hashicorp/vault-secrets-operator \
  --namespace vault-secrets-operator-system --create-namespace \
  --wait --timeout 120s

echo "==> Waiting for VSO pods to be ready..."
kubectl wait --namespace vault-secrets-operator-system \
  --for=condition=ready pod \
  --all \
  --timeout=120s

echo "==> Vault and VSO installed successfully"
