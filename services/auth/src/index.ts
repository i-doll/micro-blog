import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppError, corsConfig } from '@blog/shared';
import { ZodError } from 'zod';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { connectNats, disconnectNats } from './services/nats.js';
import { initKeys } from './jwks.js';
import { authRoutes } from './routes/auth.js';
import { bootstrapAdmin } from './services/auth.js';
import { subscribeUserUpdated } from './subscribers/user-updated.js';
import { subscribeUserDeleted } from './subscribers/user-deleted.js';

const app = Fastify({ logger: { level: config.logLevel } });

await app.register(cors, corsConfig());

// Error handler
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

// Health check
app.get('/health', async () => ({ status: 'healthy', service: 'auth-service' }));

// Aggregated system status — fans out health checks to all services
app.get('/auth/system-status', async (_request, reply) => {
  const services: Record<string, string> = {
    'auth-service': `http://localhost:${config.port}/health`,
    'user-service': `http://${process.env.USER_SERVICE_HOST || 'user-service:3001'}/health`,
    'post-service': `http://${process.env.POST_SERVICE_HOST || 'post-service:3002'}/health`,
    'comment-service': `http://${process.env.COMMENT_SERVICE_HOST || 'comment-service:3003'}/health`,
    'notification-service': `http://${process.env.NOTIFICATION_SERVICE_HOST || 'notification-service:3004'}/health`,
    'search-service': `http://${process.env.SEARCH_SERVICE_HOST || 'search-service:3005'}/health`,
    'media-service': `http://${process.env.MEDIA_SERVICE_HOST || 'media-service:3006'}/health`,
    'captcha-service': `http://${process.env.CAPTCHA_SERVICE_HOST || 'captcha-service:3008'}/health`,
    'search-indexer': `http://${process.env.SEARCH_INDEXER_HOST || 'search-indexer:3005'}/health`,
  };

  const results: Record<string, unknown> = {};
  let allHealthy = true;

  await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          results[name] = 'healthy';
        } else {
          allHealthy = false;
          results[name] = { status: 'unhealthy', code: resp.status };
        }
      } catch (e) {
        allHealthy = false;
        results[name] = { status: 'unreachable', error: String(e) };
      }
    }),
  );

  const status = allHealthy ? 'healthy' : 'degraded';
  return reply.status(allHealthy ? 200 : 503).send({ status, services: results });
});

// Routes
await app.register(authRoutes);

// Start
try {
  await initKeys();
  await runMigrations();
  await connectNats();
  await bootstrapAdmin();
  await subscribeUserUpdated();
  await subscribeUserDeleted();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Auth service listening on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    await app.close();
    await disconnectNats();
    process.exit(0);
  });
}
