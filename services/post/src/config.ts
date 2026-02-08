function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsNkeySeed: process.env.NATS_NKEY_SEED || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};
