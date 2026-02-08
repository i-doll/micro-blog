function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3009', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsNkeySeed: process.env.NATS_NKEY_SEED || '',
  rsaPrivateKeyPath: process.env.RSA_PRIVATE_KEY_PATH || '',
  jwtExpiryHours: parseInt(process.env.JWT_EXPIRY_HOURS || '24', 10),
  refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10),
  captchaSecret: process.env.CAPTCHA_SECRET || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
};
