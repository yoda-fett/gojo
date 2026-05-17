// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SavingsCardNudge } from './savings-card-nudge';
import type { SavingsCardSnapshot } from '@/lib/dashboard/savings-card';

function makeSnapshot(overrides: Partial<SavingsCardSnapshot> = {}): SavingsCardSnapshot {
  return {
    alertId: 'alert-1',
    dayOffset: 100,
    daysRemaining: 24,
    savingsAmount: 2840,
    directBookingCount: 14,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SavingsCardNudge', () => {
  it('renders the standard variant for daysRemaining > 7', () => {
    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-1',
        snapshot: makeSnapshot({ dayOffset: 100, daysRemaining: 24 }),
      }),
    );
    expect(screen.getByText(/Trial day 100 of 124/)).toBeTruthy();
    expect(screen.getByText(/24 days left in your trial/)).toBeTruthy();
    // CTA is the only <a> on the card; match by role for specificity.
    expect(screen.getByRole('link').textContent).toContain('Convert to a paid plan');
    // Standard variant exposes the strikethrough proof line.
    expect(screen.getByText(/14 direct bookings/)).toBeTruthy();
    expect(screen.getByRole('region').getAttribute('data-variant')).toBe('standard');
  });

  it('flips to the urgent variant when daysRemaining <= 7', () => {
    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-1',
        snapshot: makeSnapshot({ dayOffset: 117, daysRemaining: 7 }),
      }),
    );
    expect(screen.getByText(/Grace period/)).toBeTruthy();
    expect(screen.getByText(/Choose a plan/)).toBeTruthy();
    expect(screen.getByText(/until OTA pause/)).toBeTruthy();
    expect(screen.getByRole('region').getAttribute('data-variant')).toBe('urgent');
  });

  it('CTA href is buildUpgradeUrl(propertyId)', () => {
    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-xyz',
        snapshot: makeSnapshot(),
      }),
    );
    const cta = screen.getByRole('link') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toContain('/billing/upgrade');
    expect(cta.getAttribute('href')).toContain('property=prop-xyz');
  });

  it('POSTs to /api/alerts/[id]/dismiss and hides on success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'alert-1', status: 'DISMISSED' }),
    } as Response);

    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-1',
        snapshot: makeSnapshot(),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss savings card' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/alerts/alert-1/dismiss');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull();
    });
  });

  it('shows an inline error when dismiss fails and keeps the card visible', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
    } as Response);

    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-1',
        snapshot: makeSnapshot(),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss savings card' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('region')).toBeTruthy();
  });

  it('has the accessibility attributes from the spec', () => {
    render(
      React.createElement(SavingsCardNudge, {
        propertyId: 'prop-1',
        snapshot: makeSnapshot(),
      }),
    );
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toBe('Trial conversion savings');
    expect(screen.getByRole('button', { name: 'Dismiss savings card' })).toBeTruthy();
  });
});
