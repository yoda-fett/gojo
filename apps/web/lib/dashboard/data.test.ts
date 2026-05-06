import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  room: { findMany: vi.fn() },
  roomType: { findMany: vi.fn() },
  guest: { findMany: vi.fn() },
  reservation: { findMany: vi.fn(), count: vi.fn() },
  folio: { findMany: vi.fn() },
  folioLine: { findMany: vi.fn() },
  alert: { findMany: vi.fn() },
  $queryRawUnsafe: vi.fn(),
};

vi.mock('@gojo/db', () => ({
  prisma: mockPrisma,
}));

describe('dashboard analytics data', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-101', roomTypeId: 'rt-standard', number: '101', state: 'CLEAN', updatedAt: new Date('2026-04-25T08:00:00+05:30') },
      { id: 'room-102', roomTypeId: 'rt-standard', number: '102', state: 'CLEAN', updatedAt: new Date('2026-04-25T08:00:00+05:30') },
    ]);
    mockPrisma.roomType.findMany.mockResolvedValue([
      { id: 'rt-standard', name: 'Standard' },
    ]);
    mockPrisma.guest.findMany.mockResolvedValue([]);
    mockPrisma.reservation.findMany.mockResolvedValue([
      {
        id: 'res-checkout-today',
        guestId: 'guest-1',
        roomId: 'room-101',
        roomTypeId: 'rt-standard',
        checkIn: new Date('2026-04-24T14:00:00+05:30'),
        checkOut: new Date('2026-04-25T10:30:00+05:30'),
        status: 'CHECKED_OUT',
        source: 'DIRECT_BOOKING',
      },
      {
        id: 'res-in-house',
        guestId: 'guest-2',
        roomId: 'room-102',
        roomTypeId: 'rt-standard',
        checkIn: new Date('2026-04-25T09:00:00+05:30'),
        checkOut: new Date('2026-04-26T11:00:00+05:30'),
        status: 'CHECKED_IN',
        source: 'OTA',
      },
    ]);
    mockPrisma.folio.findMany.mockResolvedValue([
      { id: 'folio-1', reservationId: 'res-checkout-today' },
      { id: 'folio-2', reservationId: 'res-in-house' },
    ]);
    mockPrisma.folioLine.findMany.mockResolvedValue([
      {
        folioId: 'folio-1',
        amount: 4800,
        chargeType: 'ROOM',
        postedAt: new Date('2026-04-24T18:00:00+05:30'),
      },
      {
        folioId: 'folio-2',
        amount: 5000,
        chargeType: 'ROOM',
        postedAt: new Date('2026-04-25T18:00:00+05:30'),
      },
    ]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.alert.findMany.mockResolvedValue([]);
  });

  it('counts only in-range room nights and excludes checkout-day occupancy', async () => {
    const { getOccupancyReport, getRevenueReport } = await import('./data');
    const range = { from: '2026-04-25', to: '2026-04-25', label: 'Today' };

    const occupancy = await getOccupancyReport('property-1', range);
    const revenue = await getRevenueReport('property-1', range);

    expect(occupancy.kpis.totalRoomNights).toBe(1);
    expect(occupancy.kpis.avgOccupancyPct).toBe(50);
    expect(occupancy.kpis.adr).toBe(5000);
    expect(occupancy.dailySeries).toEqual([
      {
        date: '2026-04-25',
        occupancyRate: 50,
        revenue: 5000,
        roomsOccupied: 1,
      },
    ]);

    expect(revenue.byRoomType).toEqual([
      {
        roomType: 'Standard',
        roomCount: 2,
        nightsSold: 1,
        adr: 5000,
        occupancyPct: 50,
        revenue: 5000,
      },
    ]);
    expect(revenue.bySource).toEqual([
      { source: 'DIRECT_BOOKING', amount: 0, sharePct: 0 },
      { source: 'OTA', amount: 5000, sharePct: 100 },
      { source: 'WALK_IN', amount: 0, sharePct: 0 },
    ]);
  });

  describe('getReservationsReport', () => {
    const range = { from: '2026-04-01', to: '2026-04-30', label: 'April' };

    function makeReservation(overrides: Record<string, unknown>) {
      return {
        id: 'res',
        propertyId: 'property-1',
        roomId: 'room-101',
        roomTypeId: 'rt-standard',
        guestId: 'guest-1',
        checkIn: new Date('2026-04-10T14:00:00+05:30'),
        checkOut: new Date('2026-04-12T11:00:00+05:30'),
        status: 'CONFIRMED',
        source: 'DIRECT_BOOKING',
        cancelledAt: null,
        createdAt: new Date('2026-04-05T10:00:00+05:30'),
        rateSnapshot: { nightlyRate: 3000, currency: 'INR' },
        ...overrides,
      };
    }

    it('aggregates KPIs and source breakdown for created/cancelled/checked-out windows', async () => {
      const created = [
        makeReservation({ id: 'r1', source: 'DIRECT_BOOKING', status: 'CONFIRMED' }),
        makeReservation({ id: 'r2', source: 'OTA', status: 'CHECKED_OUT', createdAt: new Date('2026-04-02T09:00:00+05:30'), checkIn: new Date('2026-04-08T15:00:00+05:30'), checkOut: new Date('2026-04-11T11:00:00+05:30'), rateSnapshot: { nightlyRate: 2500, currency: 'INR' } }),
        makeReservation({ id: 'r3', source: 'OTA', status: 'CANCELLED', cancelledAt: new Date('2026-04-15T08:00:00+05:30'), rateSnapshot: { total: 5000 } }),
      ];
      const cancelled = [created[2]];
      const checkedOut = [{ ...created[1] }];

      mockPrisma.reservation.findMany
        .mockResolvedValueOnce(created)
        .mockResolvedValueOnce(cancelled)
        .mockResolvedValueOnce(checkedOut)
        .mockResolvedValueOnce(checkedOut);
      mockPrisma.reservation.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const { getReservationsReport } = await import('./data');
      const data = await getReservationsReport('property-1', range);

      expect(data.kpis.totalBookings).toBe(3);
      expect(data.kpis.newBookings).toBe(1);
      expect(data.kpis.cancellations).toBe(1);
      expect(data.kpis.avgLengthOfStay).toBeCloseTo(3, 1);
      expect(data.kpis.avgLeadTime).toBeGreaterThan(0);

      const direct = data.bySource.find((row) => row.source === 'DIRECT_BOOKING');
      const ota = data.bySource.find((row) => row.source === 'OTA');
      expect(direct?.bookings).toBe(1);
      expect(ota?.bookings).toBe(2);
      expect(ota?.cancelRate).toBe(50);
      expect(direct?.revenue).toBe(6000);
      expect(ota?.revenue).toBe(12500);
    });

    it('returns zeros when no reservations exist in period', async () => {
      mockPrisma.reservation.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.reservation.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const { getReservationsReport } = await import('./data');
      const data = await getReservationsReport('property-1', range);

      expect(data.kpis.totalBookings).toBe(0);
      expect(data.kpis.newBookings).toBe(0);
      expect(data.kpis.cancellations).toBe(0);
      expect(data.kpis.avgLengthOfStay).toBe(0);
      expect(data.kpis.avgLeadTime).toBe(0);
      expect(data.bySource.every((row) => row.bookings === 0)).toBe(true);
      expect(data.totalRevenue).toBe(0);
    });
  });

  describe('getFolioReport', () => {
    const range = { from: '2026-04-01', to: '2026-04-30', label: 'April' };

    it('aggregates KPIs and category breakdown across charge types', async () => {
      const periodLines = [
        { folioId: 'f1', chargeType: 'ROOM_CHARGE', amount: 5000, postedAt: new Date('2026-04-05T10:00:00+05:30') },
        { folioId: 'f1', chargeType: 'EXTRA_CHARGE', amount: 800, postedAt: new Date('2026-04-06T10:00:00+05:30') },
        { folioId: 'f1', chargeType: 'PAYMENT', amount: 5800, postedAt: new Date('2026-04-07T10:00:00+05:30') },
        { folioId: 'f2', chargeType: 'ROOM_CHARGE', amount: 4000, postedAt: new Date('2026-04-10T10:00:00+05:30') },
        { folioId: 'f2', chargeType: 'PAYMENT', amount: 2000, postedAt: new Date('2026-04-11T10:00:00+05:30') },
        { folioId: 'f2', chargeType: 'DISCOUNT', amount: 500, postedAt: new Date('2026-04-12T10:00:00+05:30') },
        { folioId: 'f3', chargeType: 'TAX_ADJUSTMENT', amount: 200, postedAt: new Date('2026-04-15T10:00:00+05:30') },
      ];
      const openFolios = [{ id: 'f2', status: 'OPEN', settledAt: null }];
      const closedFolios = [{ id: 'f1', status: 'CLOSED', settledAt: new Date('2026-04-07T11:00:00+05:30') }];
      const openFolioLines = periodLines.filter((line) => line.folioId === 'f2');
      const closedFolioLines = periodLines.filter((line) => line.folioId === 'f1');

      mockPrisma.folioLine.findMany
        .mockResolvedValueOnce(periodLines) // current period
        .mockResolvedValueOnce([])           // prior period
        .mockResolvedValueOnce(openFolioLines)
        .mockResolvedValueOnce(closedFolioLines);
      mockPrisma.folio.findMany.mockResolvedValueOnce(openFolios).mockResolvedValueOnce(closedFolios);

      const { getFolioReport } = await import('./data');
      const data = await getFolioReport('property-1', range);

      expect(data.kpis.totalCharged).toBe(9800); // 5000 + 800 + 4000
      expect(data.kpis.totalCollected).toBe(7800); // 5800 + 2000
      expect(data.kpis.refundsAdjustments).toBe(700); // 500 + 200
      expect(data.kpis.outstanding).toBe(1500); // 4000 - 2000 - 500
      expect(data.kpis.avgFolioValue).toBe(5800); // f1 charges (5000+800)
      expect(data.kpis.collectionRate).toBeCloseTo((7800 / 9800) * 100, 1);

      const room = data.byCategory.find((row) => row.category === 'ROOM_CHARGE');
      expect(room?.grossPosted).toBe(9000);
      expect(data.byCategory[0]?.category).toBe('ROOM_CHARGE'); // sorted desc
    });

    it('returns zeros when no folio activity in period', async () => {
      mockPrisma.folioLine.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.folio.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const { getFolioReport } = await import('./data');
      const data = await getFolioReport('property-1', range);

      expect(data.kpis.totalCharged).toBe(0);
      expect(data.kpis.totalCollected).toBe(0);
      expect(data.kpis.outstanding).toBe(0);
      expect(data.kpis.avgFolioValue).toBe(0);
      expect(data.byCategory).toEqual([]);
      expect(data.outstandingFolios).toEqual([]);
    });
  });
});
