import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    // 32 bytes hex-encoded. In Phase 2 fall back to a deterministic dev key
    // so local environments without secrets still work — production must
    // set this env var (see pre-deployment-todo.md).
    return Buffer.from('00'.repeat(32), 'hex');
  }
  return Buffer.from(raw, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function generateRandomSecret(): string {
  return randomBytes(32).toString('hex');
}
