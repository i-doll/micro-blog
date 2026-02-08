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

// 5x7 bitmap font — each glyph is 7 rows of 5-bit bitmasks (MSB = leftmost pixel).
// No <text> elements are ever emitted; characters are rendered as <path> rects
// so there is zero selectable/copyable text in the SVG.
const GLYPHS: Record<string, number[]> = {
  A: [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  B: [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  C: [0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
  D: [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  E: [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  F: [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  G: [0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01110],
  H: [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  J: [0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  K: [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  L: [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  M: [0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001],
  N: [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  P: [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  Q: [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  R: [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  S: [0b01110,0b10001,0b10000,0b01110,0b00001,0b10001,0b01110],
  T: [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  U: [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  V: [0b10001,0b10001,0b10001,0b10001,0b01010,0b01010,0b00100],
  W: [0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  X: [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  Y: [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  Z: [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  a: [0b00000,0b00000,0b01110,0b00001,0b01111,0b10001,0b01111],
  b: [0b10000,0b10000,0b10110,0b11001,0b10001,0b10001,0b11110],
  c: [0b00000,0b00000,0b01110,0b10000,0b10000,0b10001,0b01110],
  d: [0b00001,0b00001,0b01101,0b10011,0b10001,0b10001,0b01111],
  e: [0b00000,0b00000,0b01110,0b10001,0b11111,0b10000,0b01110],
  f: [0b00110,0b01001,0b01000,0b11100,0b01000,0b01000,0b01000],
  g: [0b00000,0b01111,0b10001,0b10001,0b01111,0b00001,0b01110],
  h: [0b10000,0b10000,0b10110,0b11001,0b10001,0b10001,0b10001],
  j: [0b00010,0b00000,0b00110,0b00010,0b00010,0b10010,0b01100],
  k: [0b10000,0b10000,0b10010,0b10100,0b11000,0b10100,0b10010],
  m: [0b00000,0b00000,0b11010,0b10101,0b10101,0b10001,0b10001],
  n: [0b00000,0b00000,0b10110,0b11001,0b10001,0b10001,0b10001],
  p: [0b00000,0b00000,0b11110,0b10001,0b11110,0b10000,0b10000],
  q: [0b00000,0b00000,0b01101,0b10011,0b01111,0b00001,0b00001],
  r: [0b00000,0b00000,0b10110,0b11001,0b10000,0b10000,0b10000],
  s: [0b00000,0b00000,0b01110,0b10000,0b01110,0b00001,0b11110],
  t: [0b01000,0b01000,0b11100,0b01000,0b01000,0b01001,0b00110],
  u: [0b00000,0b00000,0b10001,0b10001,0b10001,0b10011,0b01101],
  v: [0b00000,0b00000,0b10001,0b10001,0b10001,0b01010,0b00100],
  w: [0b00000,0b00000,0b10001,0b10001,0b10101,0b10101,0b01010],
  x: [0b00000,0b00000,0b10001,0b01010,0b00100,0b01010,0b10001],
  y: [0b00000,0b00000,0b10001,0b10001,0b01111,0b00001,0b01110],
  z: [0b00000,0b00000,0b11111,0b00010,0b00100,0b01000,0b11111],
  '2': [0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111],
  '3': [0b11111,0b00010,0b00100,0b00010,0b00001,0b10001,0b01110],
  '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  '5': [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
  '6': [0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110],
  '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00010,0b01100],
};

function renderGlyphPath(ch: string, ox: number, oy: number, scale: number): string {
  const rows = GLYPHS[ch];
  if (!rows) return '';
  let d = '';
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & (1 << (4 - col))) {
        const x = ox + col * scale;
        const y = oy + row * scale;
        d += `M${x},${y}h${scale}v${scale}h-${scale}z`;
      }
    }
  }
  return d;
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

  // Characters rendered as <path> geometry — no <text> elements, nothing to
  // select or copy. Each glyph is a 5x7 bitmap drawn as filled rectangles.
  const scale = randomInt(3, 4);
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const spacing = (width - text.length * glyphW) / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const ox = spacing + i * (glyphW + spacing);
    const baseY = (height - glyphH) / 2;
    const yJitter = randomInt(-6, 6);
    const rotation = randomInt(-12, 12);
    const r = randomInt(0, 80);
    const g = randomInt(0, 80);
    const b = randomInt(0, 80);
    const cx = ox + glyphW / 2;
    const cy = baseY + yJitter + glyphH / 2;
    const d = renderGlyphPath(text[i], ox, baseY + yJitter, scale);
    svg += `<path d="${d}" fill="rgb(${r},${g},${b})" transform="rotate(${rotation},${cx},${cy})"/>`;
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

  const token = jwt.sign({ v: true, jti: crypto.randomUUID() }, config.captchaSecret, {
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
