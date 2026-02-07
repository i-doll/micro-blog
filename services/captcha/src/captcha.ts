import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

interface StoredChallenge {
  answer: string;
  expiresAt: number;
}

const store = new Map<string, StoredChallenge>();

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomChar(): string {
  return CHARSET[crypto.randomInt(CHARSET.length)];
}

function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

function renderSvg(text: string): string {
  const width = 200;
  const height = 70;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#f0f0f0"/>`;

  // Noise lines (5-8)
  const lineCount = randomInt(5, 8);
  for (let i = 0; i < lineCount; i++) {
    const x1 = randomInt(0, width);
    const y1 = randomInt(0, height);
    const x2 = randomInt(0, width);
    const y2 = randomInt(0, height);
    const r = randomInt(100, 200);
    const g = randomInt(100, 200);
    const b = randomInt(100, 200);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgb(${r},${g},${b})" stroke-width="1"/>`;
  }

  // Noise dots (30-50)
  const dotCount = randomInt(30, 50);
  for (let i = 0; i < dotCount; i++) {
    const cx = randomInt(0, width);
    const cy = randomInt(0, height);
    const r = randomInt(100, 200);
    const g = randomInt(100, 200);
    const b = randomInt(100, 200);
    svg += `<circle cx="${cx}" cy="${cy}" r="1" fill="rgb(${r},${g},${b})"/>`;
  }

  // Characters
  const charWidth = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = charWidth * (i + 0.5);
    const y = height / 2;
    const rotation = randomInt(-15, 15);
    const yJitter = randomInt(-8, 8);
    const fontSize = randomInt(24, 32);
    const r = randomInt(0, 80);
    const g = randomInt(0, 80);
    const b = randomInt(0, 80);
    svg += `<text x="${x}" y="${y + yJitter}" font-size="${fontSize}" font-family="monospace, serif" fill="rgb(${r},${g},${b})" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotation},${x},${y + yJitter})">${text[i]}</text>`;
  }

  svg += '</svg>';
  return svg;
}

export function generateChallenge(): { id: string; image: string } {
  let text = '';
  for (let i = 0; i < 6; i++) {
    text += randomChar();
  }

  const id = crypto.randomUUID();
  store.set(id, {
    answer: text.toLowerCase(),
    expiresAt: Date.now() + config.challengeTtlMs,
  });

  return { id, image: renderSvg(text) };
}

export function verifyChallenge(id: string, answer: string): string | null {
  const challenge = store.get(id);
  store.delete(id);

  if (!challenge) return null;
  if (Date.now() > challenge.expiresAt) return null;

  const expected = Buffer.from(challenge.answer, 'utf8');
  const actual = Buffer.from(answer.toLowerCase(), 'utf8');

  // Pad to equal length for timingSafeEqual
  const maxLen = Math.max(expected.length, actual.length);
  const paddedExpected = Buffer.alloc(maxLen, 0);
  const paddedActual = Buffer.alloc(maxLen, 0);
  expected.copy(paddedExpected);
  actual.copy(paddedActual);

  if (!crypto.timingSafeEqual(paddedExpected, paddedActual)) return null;

  const token = jwt.sign({ v: true }, config.captchaSecret, {
    expiresIn: config.tokenExpirySeconds,
  });

  return token;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startCleanupInterval(): void {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, challenge] of store) {
      if (now > challenge.expiresAt) {
        store.delete(id);
      }
    }
  }, 60_000);
}

export function stopCleanupInterval(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
