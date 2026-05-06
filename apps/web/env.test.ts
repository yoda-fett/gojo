import { describe, expect, it, vi } from 'vitest';

describe('web env validation', () => {
  it('throws when DATABASE_URL is missing', async () => {
    vi.resetModules();
    const previous = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    process.env['JWT_SECRET'] = 'x'.repeat(32);

    await expect(import('./env')).rejects.toThrow(/DATABASE_URL/);

    process.env['DATABASE_URL'] = previous;
  });
});
