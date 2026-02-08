import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { config } from '../config.js';
import { getJetStream } from './nats.js';
import {
  USER_CREATED,
  createEnvelope,
  type UserCreated,
  type JwtClaims,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@blog/shared';
import { StringCodec } from 'nats';

const sc = StringCodec();

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken + config.jwtSecret).digest('hex');
}

export async function register(username: string, email: string, password: string) {
  // Check for existing credentials
  const existing = await db.query.credentials.findFirst({
    where: (creds, { or, eq }) => or(eq(creds.email, email), eq(creds.username, username)),
  });
  if (existing) {
    throw new ConflictError('User with this email or username already exists');
  }

  const password_hash = await bcrypt.hash(password, 12);
  const role = 'user';
  const [cred] = await db.insert(schema.credentials).values({
    username,
    email,
    password_hash,
    role,
  }).returning();

  // Publish user.created event so user-service creates a profile
  const js = getJetStream();
  const event = createEnvelope<UserCreated>({
    user_id: cred.id,
    username: cred.username,
    email: cred.email,
    role: cred.role,
  });
  await js.publish(USER_CREATED, sc.encode(JSON.stringify(event)));

  return { id: cred.id, username: cred.username, email: cred.email, role: cred.role };
}

export async function login(email: string, password: string) {
  const cred = await db.query.credentials.findFirst({
    where: (creds, { eq }) => eq(creds.email, email),
  });
  if (!cred || !cred.active) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, cred.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const claims: JwtClaims = {
    sub: cred.id,
    username: cred.username,
    role: cred.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.jwtExpiryHours * 3600,
  };

  const access_token = jwt.sign(claims, config.jwtSecret);

  // Generate refresh token
  const refreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiryDays * 24 * 3600 * 1000);

  await db.insert(schema.refreshTokens).values({
    user_id: cred.id,
    token: hashRefreshToken(refreshToken),
    expires_at: expiresAt,
  });

  return {
    access_token,
    refresh_token: refreshToken,
    user: { id: cred.id, username: cred.username, email: cred.email, role: cred.role },
  };
}

export async function refresh(refreshToken: string) {
  const tokenRow = await db.query.refreshTokens.findFirst({
    where: (tokens, { eq, gt, and }) =>
      and(eq(tokens.token, hashRefreshToken(refreshToken)), gt(tokens.expires_at, new Date())),
  });

  if (!tokenRow) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const cred = await db.query.credentials.findFirst({
    where: (creds, { eq }) => eq(creds.id, tokenRow.user_id),
  });

  if (!cred || !cred.active) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Delete old refresh token
  await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.id, tokenRow.id));

  const claims: JwtClaims = {
    sub: cred.id,
    username: cred.username,
    role: cred.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.jwtExpiryHours * 3600,
  };

  const access_token = jwt.sign(claims, config.jwtSecret);

  // New refresh token
  const newRefreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiryDays * 24 * 3600 * 1000);

  await db.insert(schema.refreshTokens).values({
    user_id: cred.id,
    token: hashRefreshToken(newRefreshToken),
    expires_at: expiresAt,
  });

  return { access_token, refresh_token: newRefreshToken };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const cred = await db.query.credentials.findFirst({
    where: (creds, { eq }) => eq(creds.id, userId),
  });
  if (!cred) {
    throw new NotFoundError('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, cred.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  await db
    .update(schema.credentials)
    .set({ password_hash, updated_at: new Date() })
    .where(eq(schema.credentials.id, userId));

  // Invalidate all refresh tokens to force re-login on other sessions
  await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.user_id, userId));
}

/**
 * Seed an admin credential from environment variables at startup.
 * If ADMIN_EMAIL and ADMIN_PASSWORD are set:
 *   - Creates the admin credential if no credential with that email exists
 *   - Promotes the existing credential to admin if they already registered with 'user' role
 * If the env vars are not set, this is a no-op.
 */
export async function bootstrapAdmin() {
  const adminEmail = config.adminEmail;
  const adminPassword = config.adminPassword;
  if (!adminEmail || !adminPassword) return;

  const adminUsername = config.adminUsername;

  const existing = await db.query.credentials.findFirst({
    where: (creds, { eq }) => eq(creds.email, adminEmail),
  });

  if (existing) {
    if (existing.role !== 'admin') {
      await db
        .update(schema.credentials)
        .set({ role: 'admin', updated_at: new Date() })
        .where(eq(schema.credentials.id, existing.id));
      console.log(`Promoted existing credential ${adminEmail} to admin`);
    }
    return;
  }

  const password_hash = await bcrypt.hash(adminPassword, 12);
  const [cred] = await db.insert(schema.credentials).values({
    username: adminUsername,
    email: adminEmail,
    password_hash,
    role: 'admin',
  }).returning();

  // Publish user.created so user-service creates the admin profile
  const js = getJetStream();
  const event = createEnvelope<UserCreated>({
    user_id: cred.id,
    username: cred.username,
    email: cred.email,
    role: cred.role,
  });
  await js.publish(USER_CREATED, sc.encode(JSON.stringify(event)));

  console.log(`Created admin credential: ${adminEmail}`);
}
