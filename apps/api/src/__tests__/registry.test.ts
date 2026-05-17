import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearHandlersForTests,
  dispatch,
  getHandler,
  registerHandler,
} from '../workers/registry.js';

afterEach(() => {
  clearHandlersForTests();
});

describe('worker handler registry', () => {
  it('registers and retrieves a handler', () => {
    const handler = vi.fn(async () => 'ok');
    registerHandler('FOO', handler);
    expect(getHandler('FOO')).toBe(handler);
  });

  it('throws on duplicate registration', () => {
    registerHandler('FOO', async () => 'a');
    expect(() => registerHandler('FOO', async () => 'b')).toThrow(
      /already registered/i,
    );
  });

  it('dispatches by job.name', async () => {
    const handler = vi.fn(async () => 'done');
    registerHandler('TRIAL_NUDGE', handler);
    const job = { name: 'TRIAL_NUDGE', data: { x: 1 } } as never;
    await expect(dispatch(job)).resolves.toBe('done');
    expect(handler).toHaveBeenCalledWith(job);
  });

  it('throws on unknown job name', async () => {
    const job = { name: 'NOPE' } as never;
    await expect(dispatch(job)).rejects.toThrow(/No handler registered/);
  });
});
