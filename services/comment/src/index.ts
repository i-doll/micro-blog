import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppError, corsConfig } from '@blog/shared';
import { ZodError } from 'zod';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { connectNats, disconnectNats } from './services/nats.js';
import { commentRoutes } from './routes/comments.js';
import { subscribePostDeleted } from './subscribers/post-deleted.js';
import { subscribeUserDeleted } from './subscribers/user-deleted.js';

const app = Fastify({ logger: { level: config.logLevel } });

await app.register(cors, corsConfig());

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

app.get('/health', async () => ({ status: 'healthy', service: 'comment-service' }));

await app.register(commentRoutes);

try {
  await runMigrations();
  await connectNats();
  await subscribePostDeleted();
  await subscribeUserDeleted();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Comment service listening on port ${config.port}`);
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
