import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
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

export async function register(username: string, email: string, password: string) {
  // Check for existing user
  const existing = await db.query.users.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });
  if (existing) {
    throw new ConflictError('User with this email or username already exists');
  }

  const password_hash = await bcrypt.hash(password, 12);
  const role = assignRegistrationRole(email);
  const [user] = await db.insert(schema.users).values({
    username,
    email,
    password_hash,
    role,
  }).returning();

  // Publish user.created event
  const js = getJetStream();
  const event = createEnvelope<UserCreated>({
    user_id: user.id,
    username: user.username,
    email: user.email,
  });
  await js.publish(USER_CREATED, sc.encode(JSON.stringify(event)));

  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

export async function login(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });
  if (!user || !user.active) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const claims: JwtClaims = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.jwtExpiryHours * 3600,
  };

  const access_token = jwt.sign(claims, config.jwtSecret);

  // Generate refresh token
  const refreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiryDays * 24 * 3600 * 1000);

  await db.insert(schema.refreshTokens).values({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
  });

  return {
    access_token,
    refresh_token: refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  };
}

export async function refresh(refreshToken: string) {
  const tokenRow = await db.query.refreshTokens.findFirst({
    where: (tokens, { eq, gt, and }) =>
      and(eq(tokens.token, refreshToken), gt(tokens.expires_at, new Date())),
  });

  if (!tokenRow) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, tokenRow.user_id),
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Delete old refresh token
  await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.id, tokenRow.id));

  const claims: JwtClaims = {
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.jwtExpiryHours * 3600,
  };

  const access_token = jwt.sign(claims, config.jwtSecret);

  // New refresh token
  const newRefreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiryDays * 24 * 3600 * 1000);

  await db.insert(schema.refreshTokens).values({
    user_id: user.id,
    token: newRefreshToken,
    expires_at: expiresAt,
  });

  return { access_token, refresh_token: newRefreshToken };
}

/**
 * Determine the role assigned to a newly registered user.
 * Always returns 'user' — admin privileges are never granted via registration.
 * Admin accounts are bootstrapped at startup via ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
export function assignRegistrationRole(_email: string): string {
  return 'user';
}

/**
 * Seed an admin user from environment variables at startup.
 * If ADMIN_EMAIL and ADMIN_PASSWORD are set:
 *   - Creates the admin user if no user with that email exists
 *   - Promotes the existing user to admin if they already registered with 'user' role
 * If the env vars are not set, this is a no-op.
 */
export async function bootstrapAdmin() {
  const adminEmail = config.adminEmail;
  const adminPassword = config.adminPassword;
  if (!adminEmail || !adminPassword) return;

  const adminUsername = config.adminUsername;

  const existing = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, adminEmail),
  });

  if (existing) {
    if (existing.role !== 'admin') {
      await db
        .update(schema.users)
        .set({ role: 'admin', updated_at: new Date() })
        .where(eq(schema.users.id, existing.id));
      console.log(`Promoted existing user ${adminEmail} to admin`);
    }
    return;
  }

  const password_hash = await bcrypt.hash(adminPassword, 12);
  await db.insert(schema.users).values({
    username: adminUsername,
    email: adminEmail,
    password_hash,
    role: 'admin',
  });
  console.log(`Created admin user: ${adminEmail}`);
}
