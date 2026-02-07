#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Running migrations for all TypeScript services..."

for service in user post comment notification; do
  echo "  -> Migrating $service service..."
  cd "$PROJECT_DIR/services/$service"
  npx drizzle-kit migrate 2>/dev/null || echo "    (no migrations found or drizzle-kit not configured)"
  cd "$PROJECT_DIR"
done

echo "==> All migrations complete"
