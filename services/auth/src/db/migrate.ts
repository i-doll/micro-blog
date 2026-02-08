import postgres from 'postgres';
import { config } from '../config.js';

export async function runMigrations() {
  const sql = postgres(config.databaseUrl, { max: 1 });
  console.log('Ensuring database schema...');
  await sql`
    CREATE TABLE IF NOT EXISTS credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(50) NOT NULL UNIQUE,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      password_hash VARCHAR(255) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
      token_hash VARCHAR(500) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migrate existing plaintext token column to token_hash
  await sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'refresh_tokens' AND column_name = 'token')
      THEN
        DELETE FROM refresh_tokens;
        ALTER TABLE refresh_tokens RENAME COLUMN token TO token_hash;
      END IF;
    END $$;
  `;
  console.log('Schema ready');
  await sql.end();
}
