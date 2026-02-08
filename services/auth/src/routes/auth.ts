import { createHmac } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema, AppError, ForbiddenError, ValidationError, USER_ID_HEADER } from '@blog/shared';
import * as authService from '../services/auth.js';
import { getJwks } from '../jwks.js';
import { config } from '../config.js';

// Single-use captcha token tracking (same pattern as the Rust gateway)
const usedCaptchaJtis = new Map<string, number>();

function verifyCaptchaToken(captchaToken: string | undefined): void {
  if (!config.captchaSecret) return; // skip if not configured

  if (!captchaToken) {
    throw new ValidationError('Missing captcha token');
  }

  let payload: { v?: boolean; jti?: string; exp?: number };
  try {
    // Captcha tokens use HS256, separate from the RS256 auth JWTs
    // Verify HMAC signature
    const [headerB64, payloadB64, sigB64] = captchaToken.split('.');
    const expected = createHmac('sha256', config.captchaSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (sigB64 !== expected) {
      throw new Error('Invalid signature');
    }
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new ForbiddenError('Invalid or expired captcha token');
  }

  if (!payload.v) {
    throw new ForbiddenError('Invalid or expired captcha token');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new ForbiddenError('Invalid or expired captcha token');
  }

  // Enforce single-use via jti claim
  if (payload.jti) {
    // Prune expired entries
    for (const [key, exp] of usedCaptchaJtis) {
      if (exp <= now) usedCaptchaJtis.delete(key);
    }

    if (usedCaptchaJtis.has(payload.jti)) {
      throw new ForbiddenError('Captcha token already used');
    }

    usedCaptchaJtis.set(payload.jti, payload.exp ?? now + 300);
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/.well-known/jwks.json', async (_request, reply) => {
    return reply.send(getJwks());
  });

  app.post('/auth/register', async (request, reply) => {
    const captchaToken = request.headers['x-captcha-token'] as string | undefined;
    verifyCaptchaToken(captchaToken);
    const body = registerSchema.parse(request.body);
    const user = await authService.register(body.username, body.email, body.password);
    return reply.status(201).send(user);
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return reply.send(result);
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refresh(body.refresh_token);
    return reply.send(result);
  });

  app.put('/auth/password', async (request, reply) => {
    const userId = request.headers[USER_ID_HEADER] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const body = changePasswordSchema.parse(request.body);
    await authService.changePassword(userId, body.current_password, body.new_password);
    return reply.send({ message: 'Password changed successfully' });
  });
}
