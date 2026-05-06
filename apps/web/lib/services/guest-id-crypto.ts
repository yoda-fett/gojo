import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '@/env';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(env.JWT_SECRET).digest();
}

export function encryptGuestId(rawValue: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(rawValue, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGuestId(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  const [ivHex, tagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !tagHex || !encryptedHex) {
    return null;
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskGuestId(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.replace(/\s+/g, '');
  const visible = trimmed.slice(-4);
  return `•••• ${visible}`;
}
