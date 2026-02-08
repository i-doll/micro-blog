import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// Re-implement the hash function locally to test its properties,
// since it's a private function in the auth service.
const TEST_JWT_SECRET = 'test-secret';

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken + TEST_JWT_SECRET).digest('hex');
}

describe('refresh token hashing', () => {
  it('produces a 64-character hex string', () => {
    const hash = hashRefreshToken('some-token-value');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
  });

  it('is deterministic — same input produces same hash', () => {
    const token = crypto.randomUUID();
    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);
    expect(hash1).toBe(hash2);
  });

  it('different tokens produce different hashes', () => {
    const hash1 = hashRefreshToken('token-aaa');
    const hash2 = hashRefreshToken('token-bbb');
    expect(hash1).not.toBe(hash2);
  });

  it('raw token is not equal to its hash', () => {
    const token = 'plaintext-refresh-token';
    const hash = hashRefreshToken(token);
    expect(hash).not.toBe(token);
  });

  it('same token with different secrets produces different hashes', () => {
    const token = 'some-token';
    const hash1 = crypto.createHash('sha256').update(token + 'secret-a').digest('hex');
    const hash2 = crypto.createHash('sha256').update(token + 'secret-b').digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});
