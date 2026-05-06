import { createHmac, timingSafeEqual } from 'node:crypto';

import { decryptSecret } from './secret-cipher.js';
import type { PrismaClient } from './generated/client/index.js';

export async function verifyOtaWebhookSignature(
  prisma: PrismaClient,
  channelId: string,
  rawPayload: string,
  signatureHex: string,
): Promise<boolean> {
  if (!signatureHex) return false;
  const secrets = await prisma.webhookSecret.findMany({
    where: {
      channelId,
      status: { in: ['ACTIVE', 'ROTATING'] },
    },
  });
  for (const row of secrets) {
    let plaintext: string;
    try {
      plaintext = decryptSecret(row.secret);
    } catch {
      continue;
    }
    const expected = createHmac('sha256', plaintext).update(rawPayload).digest('hex');
    if (signatureHex.length !== expected.length) continue;
    try {
      const a = Buffer.from(signatureHex, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      continue;
    }
  }
  return false;
}
