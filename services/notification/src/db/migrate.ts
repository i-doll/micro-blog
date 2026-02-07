import postgres from 'postgres';
import { config } from '../config.js';

export async function runMigrations() {
  const sql = postgres(config.databaseUrl, { max: 1 });
  console.log('Ensuring database schema...');
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      type VARCHAR(50) NOT NULL,
      message VARCHAR(500) NOT NULL,
      metadata JSONB DEFAULT '{}',
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('Schema ready');
  await sql.end();
}
