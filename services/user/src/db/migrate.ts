import postgres from 'postgres';
import { config } from '../config.js';

export async function runMigrations() {
  const sql = postgres(config.databaseUrl, { max: 1 });
  console.log('Ensuring database schema...');
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Clean up auth columns/tables that have moved to auth-service
  await sql`DROP TABLE IF EXISTS refresh_tokens`;
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS password_hash`;
  console.log('Schema ready');
  await sql.end();
}
