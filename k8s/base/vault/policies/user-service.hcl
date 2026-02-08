path "secret/data/blog/shared" {
  capabilities = ["read"]
}

path "secret/data/blog/admin" {
  capabilities = ["read"]
}

path "database/creds/user-service" {
  capabilities = ["read"]
}

path "secret/data/blog/nats/user-service" {
  capabilities = ["read"]
}
