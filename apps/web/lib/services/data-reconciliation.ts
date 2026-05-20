/**
 * Post-seed / data-integrity reconciliation.
 *
 * Seeds and partially-failed flows can leave rows in states that violate
 * invariants the app assumes. This job scans for those and repairs them.
 * It is safe to run repeatedly (idempotent) and runs across all properties.
 *
 * Add new reconciliation scenarios as they are discovered — each should be a
 * self-contained block that appends tagged entries to `fixes`.
 */
import { prisma } from '@gojo/db';

// Room states that mean "no guest is physically in the room right now".
const VACANT_STATES = ['AVAILABLE', 'CLEAN', 'DIRTY', 'RESERVED'];

type Fix = {
  scenario: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  from: string;
  to: string;
};

/** @gateExempt Maintenance job — system context, no Owner actor, runs across all properties. */
export async function reconcileData() {
  const fixes: Fix[] = [];

  const [rooms, checkedIn] = await Promise.all([
    prisma.room.findMany({
      where: { deletedAt: null },
      select: { id: true, number: true, propertyId: true, state: true },
    }),
    prisma.reservation.findMany({
      where: { deletedAt: null, status: 'CHECKED_IN' },
      select: { roomId: true },
    }),
  ]);

  const roomsWithGuest = new Set(checkedIn.map((reservation) => reservation.roomId));

  for (const room of rooms) {
    const hasGuest = roomsWithGuest.has(room.id);

    // Scenario A — OCCUPIED_WITHOUT_GUEST.
    // Room is OCCUPIED but no reservation is CHECKED_IN against it. This is
    // the state a normal check-out would have left as DIRTY, so repair to
    // DIRTY (bookable, and flags housekeeping).
    if (room.state === 'OCCUPIED' && !hasGuest) {
      await prisma.room.update({
        where: { id: room.id },
        data: { state: 'DIRTY', stateVersion: { increment: 1 } },
      });
      fixes.push({
        scenario: 'OCCUPIED_WITHOUT_GUEST',
        propertyId: room.propertyId,
        roomId: room.id,
        roomNumber: room.number,
        from: 'OCCUPIED',
        to: 'DIRTY',
      });
      continue;
    }

    // Scenario B — GUEST_WITHOUT_OCCUPIED.
    // A guest is CHECKED_IN but the room is in a vacant state. The room must
    // be OCCUPIED. OUT_OF_ORDER / MAINTENANCE are left alone — those are
    // intentional and reconciling them would silently drop a maintenance flag.
    if (hasGuest && VACANT_STATES.includes(room.state)) {
      await prisma.room.update({
        where: { id: room.id },
        data: { state: 'OCCUPIED', stateVersion: { increment: 1 } },
      });
      fixes.push({
        scenario: 'GUEST_WITHOUT_OCCUPIED',
        propertyId: room.propertyId,
        roomId: room.id,
        roomNumber: room.number,
        from: room.state,
        to: 'OCCUPIED',
      });
    }
  }

  const byScenario: Record<string, number> = {};
  for (const fix of fixes) {
    byScenario[fix.scenario] = (byScenario[fix.scenario] ?? 0) + 1;
  }

  return {
    scannedRooms: rooms.length,
    fixedCount: fixes.length,
    byScenario,
    fixes,
  };
}
