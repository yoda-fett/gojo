import { describe, expect, it } from 'vitest';

import { encryptSecret, decryptSecret, generateRandomSecret } from '../secret-cipher.js';

describe('secret-cipher', () => {
  it('round-trips plaintext via AES-256-GCM', () => {
    const secret = 'wh_sk_' + generateRandomSecret();
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toEqual(secret);
    expect(decryptSecret(encrypted)).toEqual(secret);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const secret = 'identical-input';
    expect(encryptSecret(secret)).not.toEqual(encryptSecret(secret));
  });

  it('throws on tampered ciphertext (auth tag check)', () => {
    const encrypted = encryptSecret('hello');
    const buf = Buffer.from(encrypted, 'base64');
    const lastIndex = buf.length - 1;
    buf[lastIndex] = (buf[lastIndex] ?? 0) ^ 0x01;
    const tampered = buf.toString('base64');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('generates a 64-char hex secret', () => {
    const s = generateRandomSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });
});
