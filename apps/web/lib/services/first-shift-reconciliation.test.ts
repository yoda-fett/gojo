import { describe, expect, it } from 'vitest';

import { classifyVariance, isArmed } from './first-shift-reconciliation';

describe('classifyVariance — Story 12.6 suggested-action heuristic', () => {
  it('clean row when observed equals declared', () => {
    const c = classifyVariance(50, 50, 50);
    expect(c).toMatchObject({ variance: 0, severity: 'CLEAN', suggestedAction: 'NONE' });
  });

  it('negative variance → WRITE_OFF', () => {
    const c = classifyVariance(50, 40, 50);
    expect(c.variance).toBe(-10);
    expect(c.suggestedAction).toBe('WRITE_OFF');
  });

  it('small positive variance (≤5%) → COUNTING_ERROR', () => {
    const c = classifyVariance(50, 52, 100); // variance 2, pct 2%
    expect(c.suggestedAction).toBe('COUNTING_ERROR');
    expect(c.severity).toBe('STANDARD');
  });

  it('large positive variance (>5%) → REDEPLOYMENT', () => {
    const c = classifyVariance(50, 60, 100); // variance 10, pct 10%
    expect(c.suggestedAction).toBe('REDEPLOYMENT');
    expect(c.severity).toBe('STANDARD'); // 10% is still STANDARD (not >10%)
  });

  it('variance >10% of total → SIGNIFICANT severity', () => {
    const c = classifyVariance(50, 65, 100); // variance 15, pct 15%
    expect(c.severity).toBe('SIGNIFICANT');
    expect(c.suggestedAction).toBe('REDEPLOYMENT');
  });

  it('negative variance >10% → SIGNIFICANT + WRITE_OFF', () => {
    const c = classifyVariance(50, 30, 100); // variance -20, pct 20%
    expect(c.severity).toBe('SIGNIFICANT');
    expect(c.suggestedAction).toBe('WRITE_OFF');
  });

  it('handles totalOwned = 0 without dividing by zero', () => {
    const c = classifyVariance(0, 0, 0);
    expect(c.variancePct).toBe(0);
    expect(c.severity).toBe('CLEAN');
  });
});

describe('isArmed — eligibility for the watcher', () => {
  const base = { coldStartCompletedAt: new Date(), coldStartLinenDeferred: false, firstShiftReconciledAt: null };

  it('armed when complete + not deferred + not reconciled', () => {
    expect(isArmed(base)).toBe(true);
  });

  it('not armed before cold-start completes', () => {
    expect(isArmed({ ...base, coldStartCompletedAt: null })).toBe(false);
  });

  it('not armed when linen was deferred', () => {
    expect(isArmed({ ...base, coldStartLinenDeferred: true })).toBe(false);
  });

  it('not armed once reconciled (AC6 one-time)', () => {
    expect(isArmed({ ...base, firstShiftReconciledAt: new Date() })).toBe(false);
  });

  it('treats null coldStartLinenDeferred as not deferred', () => {
    expect(isArmed({ ...base, coldStartLinenDeferred: null })).toBe(true);
  });
});
