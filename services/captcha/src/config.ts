function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  captchaSecret: requireEnv('CAPTCHA_SECRET'),
  challengeTtlMs: 120_000,
  tokenExpirySeconds: 120,
  logLevel: process.env.LOG_LEVEL || 'info',
};
