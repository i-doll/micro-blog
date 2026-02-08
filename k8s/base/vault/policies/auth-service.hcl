path "secret/data/blog/shared" {
  capabilities = ["read"]
}

path "secret/data/blog/admin" {
  capabilities = ["read"]
}

path "database/creds/auth-service" {
  capabilities = ["read"]
}

path "secret/data/blog/nats/auth-service" {
  capabilities = ["read"]
}
