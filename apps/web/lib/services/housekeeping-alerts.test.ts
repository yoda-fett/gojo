import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    alert: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    inventoryRestock: { aggregate: vi.fn() },
    consumptionLog: { aggregate: vi.fn() },
    consumableWriteOff: { aggregate: vi.fn() },
    catalogItem: { findFirst: vi.fn() },
    roomLinenState: { aggregate: vi.fn() },
    laundryLogItem: { aggregate: vi.fn() },
    linenWriteOff: { aggregate: vi.fn() },
    issueReport: { count: vi.fn() },
  },
}));

vi.mock('@gojo/db', () => ({ prisma: mocks.prisma }));

import { alertHref, checkPoolBelowMin, checkRestockRequired, syncWriteOffReviewPendingAlert } from './housekeeping-alerts';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.alert.findFirst.mockResolvedValue(null);
  mocks.prisma.alert.create.mockResolvedValue({ id: 'alert-1' });
  mocks.prisma.alert.updateMany.mockResolvedValue({ count: 1 });
});

describe('housekeeping alert maintenance', () => {
  it('upserts and resolves RESTOCK_REQUIRED alerts', async () => {
    mocks.prisma.catalogItem.findFirst.mockResolvedValue({ id: 'soap', name: 'Soap', unit: 'bar', restockThreshold: 5 });
    mocks.prisma.inventoryRestock.aggregate.mockResolvedValue({ _sum: { qtyAdded: 10 } });
    mocks.prisma.consumptionLog.aggregate.mockResolvedValue({ _sum: { qtyUsed: 7 } });
    mocks.prisma.consumableWriteOff.aggregate.mockResolvedValue({ _sum: { qty: 0 } });

    await checkRestockRequired('property-1', 'soap');
    expect(mocks.prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertType: 'RESTOCK_REQUIRED', entityId: 'soap' }),
    }));

    mocks.prisma.inventoryRestock.aggregate.mockResolvedValue({ _sum: { qtyAdded: 20 } });
    await checkRestockRequired('property-1', 'soap');
    expect(mocks.prisma.alert.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ alertType: 'RESTOCK_REQUIRED', entityId: 'soap' }),
    }));
  });

  it('only creates POOL_BELOW_MIN when minPoolSize exists and storage is low', async () => {
    mocks.prisma.catalogItem.findFirst.mockResolvedValue({ id: 'sheet', name: 'Sheet', totalOwned: 10, minPoolSize: 3 });
    mocks.prisma.roomLinenState.aggregate.mockResolvedValue({ _sum: { qty: 5 } });
    mocks.prisma.laundryLogItem.aggregate.mockResolvedValue({ _sum: { remainingQty: 3 } });
    mocks.prisma.linenWriteOff.aggregate.mockResolvedValue({ _sum: { qty: 0 } });

    await checkPoolBelowMin('property-1', 'sheet');
    expect(mocks.prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertType: 'POOL_BELOW_MIN', entityId: 'sheet' }),
    }));
  });

  it('syncs WRITE_OFF_REVIEW_PENDING count and deep-links by alert type', async () => {
    mocks.prisma.issueReport.count.mockResolvedValue(2);
    await syncWriteOffReviewPendingAlert('property-1');
    expect(mocks.prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertType: 'WRITE_OFF_REVIEW_PENDING', message: '2 items awaiting review' }),
    }));

    expect(alertHref({ alertType: 'RESTOCK_REQUIRED', entityId: 'soap' })).toBe('/housekeeping/inventory?tab=amenities&item=soap');
    expect(alertHref({ alertType: 'POOL_BELOW_MIN', entityId: 'sheet' })).toBe('/housekeeping/inventory?tab=linens&item=sheet');
    expect(alertHref({ alertType: 'WRITE_OFF_REVIEW_PENDING' })).toBe('/housekeeping/inventory?tab=pending');
  });
});
