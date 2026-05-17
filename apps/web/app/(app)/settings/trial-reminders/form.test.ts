// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONVERSION_ARC_CONFIG } from '@gojo/types';

import { TrialRemindersForm } from './form';

function renderForm(overrides: Partial<React.ComponentProps<typeof TrialRemindersForm>> = {}) {
  return render(
    React.createElement(TrialRemindersForm, {
      propertyId: 'prop-1',
      initialConfig: DEFAULT_CONVERSION_ARC_CONFIG,
      subscriptionStatus: 'TRIAL',
      ...overrides,
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TrialRemindersForm', () => {
  it('renders one row per default touchpoint with the type label visible', () => {
    renderForm();
    expect(screen.getAllByLabelText('Day')).toHaveLength(
      DEFAULT_CONVERSION_ARC_CONFIG.touchpoints.length,
    );
    expect(screen.getByText('In-app savings card')).toBeTruthy();
    expect(screen.getByText('Pause OTA channels')).toBeTruthy();
  });

  it('blocks save and shows an inline error when an offset is negative', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderForm();
    const firstOffset = screen.getAllByLabelText('Day')[0]!;
    fireEvent.change(firstOffset, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks save when OTA_PAUSE >= OTA_DISCONNECT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderForm();
    // OTA_PAUSE is at index 6, OTA_DISCONNECT at index 8 in the default config.
    const inputs = screen.getAllByLabelText('Day');
    fireEvent.change(inputs[6]!, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => /OTA_PAUSE/.test(el.textContent ?? ''))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PATCHes the endpoint with the full payload on save', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG }),
    } as Response);
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/properties/prop-1/conversion-arc-config');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.touchpoints).toHaveLength(DEFAULT_CONVERSION_ARC_CONFIG.touchpoints.length);
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('disables inputs and shows a banner when subscription is not TRIAL', () => {
    renderForm({ subscriptionStatus: 'ACTIVE' });
    expect(screen.getByRole('status').textContent).toMatch(/read-only/i);
    for (const input of screen.getAllByLabelText('Day') as HTMLInputElement[]) {
      expect(input.disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
