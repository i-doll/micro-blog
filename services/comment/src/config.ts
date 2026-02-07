export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://comment_service:password@localhost:5432/blog_comments',
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  logLevel: process.env.LOG_LEVEL || 'info',
};
