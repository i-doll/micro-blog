import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppError } from '@blog/shared';
import { ZodError } from 'zod';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { connectNats, disconnectNats } from './services/nats.js';
import { notificationRoutes } from './routes/notifications.js';
import { subscribeCommentCreated } from './subscribers/comment-created.js';
import { subscribePostPublished } from './subscribers/post-published.js';
import { subscribeUserDeleted } from './subscribers/user-deleted.js';

const app = Fastify({ logger: { level: config.logLevel } });

await app.register(cors);

app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'Validation failed', details: error.errors });
  }
  app.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
});

app.get('/health', async () => ({ status: 'healthy', service: 'notification-service' }));

await app.register(notificationRoutes);

try {
  await runMigrations();
  await connectNats();
  await subscribeCommentCreated();
  await subscribePostPublished();
  await subscribeUserDeleted();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Notification service listening on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    await app.close();
    await disconnectNats();
    process.exit(0);
  });
}
