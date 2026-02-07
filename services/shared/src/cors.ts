/**
 * Shared CORS configuration for Fastify services.
 *
 * Reads CORS_ORIGINS env var (comma-separated allowlist of origins).
 * When set, only listed origins are allowed. When empty, all cross-origin
 * requests are rejected (origin: false).
 *
 * Local dev example (outside Docker):
 *   export CORS_ORIGINS="http://localhost:3007,http://localhost:3000"
 */
export function corsConfig(): {
  origin: string[] | false;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
} {
  const raw = process.env.CORS_ORIGINS || '';
  const origins = raw.split(',').map(o => o.trim()).filter(Boolean);

  return {
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600,
  };
}
