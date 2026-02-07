import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AppError, corsConfig } from '@blog/shared';
import { ZodError } from 'zod';
import { config } from './config.js';
import { captchaRoutes } from './routes/captcha.js';
import { startCleanupInterval, stopCleanupInterval } from './captcha.js';

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

app.get('/health', async () => ({ status: 'healthy', service: 'captcha-service' }));

await app.register(captchaRoutes);

try {
  startCleanupInterval();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Captcha service listening on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    stopCleanupInterval();
    await app.close();
    process.exit(0);
  });
}
