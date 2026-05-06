// @ts-nocheck
import { AppError, type Actor } from '@gojo/types';

import { prisma } from '@gojo/db';

export async function assertSetupComplete(actor: Actor) {
  const [roomTypes, policies] = await Promise.all([
    prisma.roomType.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.cancellationPolicy.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);

  const missingSteps: string[] = [];
  if (roomTypes === 0) {
    missingSteps.push('ROOM_TYPE');
  }

  if (policies === 0) {
    missingSteps.push('CANCELLATION_POLICY');
  }

  if (missingSteps.length > 0) {
    throw new AppError('SETUP_INCOMPLETE', 'Property setup is not complete', 422, {
      details: { missingSteps },
    });
  }
}
