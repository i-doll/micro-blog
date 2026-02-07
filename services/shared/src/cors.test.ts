import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { corsConfig } from './cors.ts';

describe('corsConfig', () => {
  let savedOrigins: string | undefined;

  beforeEach(() => {
    savedOrigins = process.env.CORS_ORIGINS;
  });

  afterEach(() => {
    if (savedOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = savedOrigins;
    }
  });

  it('returns false origin when CORS_ORIGINS is empty', () => {
    process.env.CORS_ORIGINS = '';
    const cfg = corsConfig();
    assert.equal(cfg.origin, false);
  });

  it('returns false origin when CORS_ORIGINS is unset', () => {
    delete process.env.CORS_ORIGINS;
    const cfg = corsConfig();
    assert.equal(cfg.origin, false);
  });

  it('parses single origin', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3007';
    const cfg = corsConfig();
    assert.deepEqual(cfg.origin, ['http://localhost:3007']);
  });

  it('parses comma-separated origins and trims whitespace', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3007 , https://example.com , http://localhost:3000';
    const cfg = corsConfig();
    assert.deepEqual(cfg.origin, [
      'http://localhost:3007',
      'https://example.com',
      'http://localhost:3000',
    ]);
  });

  it('filters empty segments from trailing commas', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3007,,';
    const cfg = corsConfig();
    assert.deepEqual(cfg.origin, ['http://localhost:3007']);
  });

  it('restricts methods to safe set', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3007';
    const cfg = corsConfig();
    assert.deepEqual(cfg.methods, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
  });

  it('restricts headers to Content-Type and Authorization', () => {
    process.env.CORS_ORIGINS = 'http://localhost:3007';
    const cfg = corsConfig();
    assert.deepEqual(cfg.allowedHeaders, ['Content-Type', 'Authorization']);
  });

  it('enables credentials', () => {
    const cfg = corsConfig();
    assert.equal(cfg.credentials, true);
  });

  it('sets max-age to 3600', () => {
    const cfg = corsConfig();
    assert.equal(cfg.maxAge, 3600);
  });
});
