import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_SECRET = 'x'.repeat(32);

beforeEach(() => {
  process.env['JWT_SECRET'] = REQUIRED_SECRET;
  process.env['OTP_PROVIDER'] = 'mock';
  delete process.env['REDIS_URL'];
  delete process.env['MSG91_AUTH_KEY'];
  delete process.env['MSG91_WHATSAPP_INTEGRATED_NUMBER'];
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const stdVars = {
  ownerName: 'Asha',
  daysRemaining: 7,
  savingsAmount: 1240,
  conversionUrl: 'https://app.gojo.in/billing/upgrade',
};

describe('renderWhatsAppBody — char budget', () => {
  it('rendered body stays under 160 characters for realistic vars', async () => {
    const { renderWhatsAppBody } = await import('../services/whatsapp/send.js');
    const body = renderWhatsAppBody(stdVars);
    expect(body.length).toBeLessThan(160);
  });

  it('rendered body stays under 160 for a long owner name', async () => {
    const { renderWhatsAppBody } = await import('../services/whatsapp/send.js');
    const body = renderWhatsAppBody({
      ...stdVars,
      ownerName: 'Property With A Reasonably Long Name',
    });
    // 36-char name pushes us higher but still well under budget.
    expect(body.length).toBeLessThan(160);
  });
});

describe('sendWhatsApp — fallback path', () => {
  it('returns { ok: true, deferred: true } when provider creds are missing', async () => {
    const { sendWhatsApp } = await import('../services/whatsapp/send.js');
    const r = await sendWhatsApp({ to: '+919810000001', vars: stdVars });
    expect(r).toEqual({ ok: true, deferred: true });
  });
});

describe('sendWhatsApp — provider POST shape', () => {
  beforeEach(() => {
    process.env['MSG91_AUTH_KEY'] = 'authkey-test';
    process.env['MSG91_WHATSAPP_INTEGRATED_NUMBER'] = '919812345678';
    process.env['MSG91_WHATSAPP_NAMESPACE'] = 'ns-test';
    process.env['MSG91_WHATSAPP_TEMPLATE_NAME'] = 'gojo_trial_nudge_v1';
  });

  it('POSTs to MSG91 with authkey + template payload', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ request_id: 'mid-1' }), {
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendWhatsApp } = await import('../services/whatsapp/send.js');
    const r = await sendWhatsApp({ to: '+919810000001', vars: stdVars });
    expect(r).toEqual({ ok: true, providerMessageId: 'mid-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain('whatsapp-outbound-message');
    expect(call[1].method).toBe('POST');
    const headers = call[1].headers as Record<string, string>;
    expect(headers['authkey']).toBe('authkey-test');
    const body = JSON.parse(call[1].body as string);
    expect(body.integrated_number).toBe('919812345678');
    expect(body.payload.template.name).toBe('gojo_trial_nudge_v1');
    expect(body.payload.template.namespace).toBe('ns-test');
    expect(body.recipients[0].mobiles).toBe('919810000001');
  });

  it('returns { ok: false } on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const { sendWhatsApp } = await import('../services/whatsapp/send.js');
    const r = await sendWhatsApp({ to: '+919810000001', vars: stdVars });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/500/);
  });

  it('returns { ok: false } on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const { sendWhatsApp } = await import('../services/whatsapp/send.js');
    const r = await sendWhatsApp({ to: '+919810000001', vars: stdVars });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/network down/);
  });
});
