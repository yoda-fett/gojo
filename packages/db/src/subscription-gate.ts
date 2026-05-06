import type { Actor } from '@gojo/types';

import type { PrismaClient } from './generated/client/index.js';

/**
 * Epic 10 owns the full subscription gate implementation.
 */
export function checkSubscriptionGate(actor: Actor, action: string, db: PrismaClient): Promise<void> {
  void actor;
  void action;
  void db;
  return Promise.resolve();
}
