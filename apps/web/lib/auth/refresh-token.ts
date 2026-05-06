import { createHash } from 'node:crypto';

import { nanoid } from 'nanoid';

export function createRefreshToken() {
  const rawToken = nanoid(48);
  return {
    rawToken,
    tokenHash: sha256(rawToken),
  };
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
