import {
  SignJWT,
  importPKCS8,
  exportJWK,
  generateKeyPair,
  calculateJwkThumbprint,
} from 'jose';
import { createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';

interface JwkPublicKey {
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
  kid?: string;
}

let privateKey: CryptoKey;
let publicJwk: JwkPublicKey;
let kid: string;

export async function initKeys(): Promise<void> {
  if (config.rsaPrivateKeyPath) {
    const pem = await readFile(config.rsaPrivateKeyPath, 'utf-8');
    privateKey = (await importPKCS8(pem, 'RS256')) as CryptoKey;
    // Derive public key via Node.js crypto (importPKCS8 creates non-extractable keys)
    const pubKeyJwk = createPublicKey(pem).export({ format: 'jwk' }) as JwkPublicKey;
    publicJwk = { kty: pubKeyJwk.kty, n: pubKeyJwk.n, e: pubKeyJwk.e };
  } else {
    // Dev mode: generate ephemeral keypair
    const { publicKey, privateKey: privKey } = await generateKeyPair('RS256', {
      modulusLength: 2048,
    });
    privateKey = privKey as CryptoKey;
    const exported = await exportJWK(publicKey);
    publicJwk = { kty: exported.kty, n: exported.n, e: exported.e };
    console.log('Generated ephemeral RS256 keypair (dev mode)');
  }

  // Compute kid from public key thumbprint
  const thumbprint = await calculateJwkThumbprint(publicJwk as Parameters<typeof calculateJwkThumbprint>[0], 'sha256');
  kid = thumbprint;
}

export async function signJwt(claims: {
  sub: string;
  username: string;
  role: string;
}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer('blog-auth')
    .setIssuedAt()
    .setExpirationTime(`${config.jwtExpiryHours}h`)
    .sign(privateKey);
}

export function getJwks(): { keys: JwkPublicKey[] } {
  return {
    keys: [
      {
        ...publicJwk,
        alg: 'RS256',
        use: 'sig',
        kid,
      },
    ],
  };
}
