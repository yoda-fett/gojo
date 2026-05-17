import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    catalogItem: { findMany: vi.fn() },
    consumptionLog: { findMany: vi.fn() },
    room: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
  },
}));

vi.mock('@gojo/db', () => ({ prisma: mocks.prisma }));

import { consumptionReportCsv, getConsumptionReport } from './consumption-report';

describe('consumption report', () => {
  it('aggregates amenity-only usage and expected par variance', async () => {
    mocks.prisma.catalogItem.findMany.mockResolvedValue([
      { id: 'soap', roomTypeId: 'rt-1', name: 'Soap', unit: 'bar', expectedQtyPerStay: 2 },
    ]);
    mocks.prisma.consumptionLog.findMany.mockResolvedValue([
      { roomId: 'room-1', catalogItemId: 'soap', qtyUsed: 3 },
      { roomId: 'room-1', catalogItemId: 'linen-1', qtyUsed: 99 },
    ]);
    mocks.prisma.room.findMany.mockResolvedValue([{ id: 'room-1', number: '101', roomTypeId: 'rt-1' }]);
    mocks.prisma.reservation.findMany.mockResolvedValue([{ roomId: 'room-1', roomTypeId: 'rt-1' }]);

    const report = await getConsumptionReport('property-1', { from: '2026-05-01', to: '2026-05-14', label: 'Range' });

    expect(report.summary).toEqual([
      { catalogItemId: 'soap', name: 'Soap', unit: 'bar', totalUsed: 3, expectedTotal: 2, variance: 1 },
    ]);
    expect(report.byRoom[0]?.items).toEqual([
      { catalogItemId: 'soap', name: 'Soap', unit: 'bar', totalUsed: 3, expectedTotal: 2, variance: 1 },
    ]);
  });

  it('exports the filtered report as CSV rows', () => {
    expect(
      consumptionReportCsv({
        period: { from: '2026-05-01', to: '2026-05-14', label: 'Range' },
        expectedBasis: 'basis',
        summary: [{ catalogItemId: 'soap', name: 'Soap', unit: 'bar', totalUsed: 3, expectedTotal: 2, variance: 1 }],
        byRoom: [{ roomId: 'room-1', roomNumber: '101', roomTypeId: 'rt-1', stays: 1, items: [{ catalogItemId: 'soap', name: 'Soap', unit: 'bar', totalUsed: 3, expectedTotal: 2, variance: 1 }] }],
        totals: { totalUsed: 3, expectedTotal: 2, variance: 1 },
      }),
    ).toContain('Soap,bar,3,2,1,101,3,2,1');
  });
});
