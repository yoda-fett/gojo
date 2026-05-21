import { describe, expect, it } from 'vitest';

import { buildSections } from './sidebar';

// Story 12.7a AC1 / AC5 — the Settings rail is Owner + Manager only.
// Entry labels/order track the live sidebar; "built vs Soon" tracks which
// 12.7 slices have shipped (12.7a Settings home, 12.7b Property Profile).

function settingsSection(role?: 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING') {
  return buildSections(role).find((section) => section.label === 'Settings');
}

describe('buildSections — Settings rail', () => {
  it('renders the Settings section for OWNER with eight entries in order (AC1)', () => {
    const settings = settingsSection('OWNER');
    expect(settings).toBeDefined();
    expect(settings?.items.map((item) => item.label)).toEqual([
      'Switch Board',
      'Property Profile',
      'Room Types',
      'Rooms',
      'Rate Plans',
      'Users and Roles',
      'Housekeeping Catalog',
      'Direct Booking',
    ]);
  });

  it('renders the Settings section for MANAGER (AC1)', () => {
    expect(settingsSection('MANAGER')).toBeDefined();
  });

  it('hides the Settings section from FRONT_DESK (AC5)', () => {
    expect(settingsSection('FRONT_DESK')).toBeUndefined();
  });

  it('hides the Settings section from HOUSEKEEPING (AC5)', () => {
    expect(settingsSection('HOUSEKEEPING')).toBeUndefined();
  });

  it('hides the Settings section when role is unknown', () => {
    expect(settingsSection(undefined)).toBeUndefined();
  });

  it('enables the shipped screens and keeps not-yet-built ones disabled', () => {
    const settings = settingsSection('OWNER');
    const disabledByLabel = Object.fromEntries(
      (settings?.items ?? []).map((i) => [i.label, 'disabled' in i ? i.disabled === true : false]),
    );
    // Built today — 12.7a–f, plus pre-existing screens
    expect(disabledByLabel['Switch Board']).toBe(false);
    expect(disabledByLabel['Property Profile']).toBe(false);
    expect(disabledByLabel['Room Types']).toBe(false);
    expect(disabledByLabel['Rooms']).toBe(false);
    expect(disabledByLabel['Rate Plans']).toBe(false);
    expect(disabledByLabel['Users and Roles']).toBe(false);
    expect(disabledByLabel['Housekeeping Catalog']).toBe(false);
    expect(disabledByLabel['Direct Booking']).toBe(false);
  });
});
