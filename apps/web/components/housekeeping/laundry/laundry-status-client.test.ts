// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/chip', () => ({
  Chip: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
}));

import { LaundryStatusClient } from './laundry-status-client';

const statusPayload = {
  vendor: { name: 'Sparkle Laundry', contact: null },
  canMutate: false,
  routineItems: [{ catalogItemId: 'linen-1', name: 'Bath towel', unit: 'piece', defaultQty: 1 }],
  rows: [
    {
      roomId: 'room-101',
      roomNumber: '101',
      cycleId: 'cycle-101',
      state: 'ITEMS_OUT',
      stateLabel: 'Items out',
      overdue: true,
      itemCount: 3,
      loggedAt: '2020-01-01T00:00:00.000Z',
      createdBy: 'OWNER',
      createdByUserId: 'owner-1',
      flagCount: 2,
      flagHref: '/housekeeping/inventory?tab=pending&filter=laundry-cycle:cycle-101',
    },
  ],
};

function renderClient(payload = statusPayload) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => payload,
  } as Response);

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(LaundryStatusClient),
    ),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('LaundryStatusClient', () => {
  it('renders overdue rows, flag deep-links, and created-by labels', async () => {
    renderClient();

    expect(await screen.findByText('Room 101')).toBeTruthy();
    expect(screen.getByText('Over 24h')).toBeTruthy();
    expect(screen.getByText('Created by OWNER')).toBeTruthy();
    const flag = screen.getByText('2 items flagged').closest('a');
    expect(flag?.getAttribute('href')).toBe('/housekeeping/inventory?tab=pending&filter=laundry-cycle:cycle-101');
  });

  it('hides owner mutation controls for read-only users', async () => {
    renderClient();

    expect(await screen.findByText('Read only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /send for laundry/i })).toBeNull();
  });
});
