export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://post_service:password@localhost:5432/blog_posts',
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  logLevel: process.env.LOG_LEVEL || 'info',
};
