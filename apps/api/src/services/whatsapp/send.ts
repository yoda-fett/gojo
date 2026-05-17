// Story 10.2c: MSG91 WhatsApp send service.
// Sends an approved template message. When credentials are missing, falls
// back to a "would-send" log so worker handlers / tests can run without
// provider config.

import { env } from '../../env.js';

const MSG91_WHATSAPP_ENDPOINT =
  'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

const TEMPLATE_BODY_CHAR_BUDGET = 160;

export interface WhatsAppVars {
  ownerName: string;
  daysRemaining: number;
  savingsAmount: number;
  conversionUrl: string;
}

export interface SendWhatsAppParams {
  /** E.164 phone, e.g. "+919810000001". */
  to: string;
  /** MSG91 approved template name. Defaults to env MSG91_WHATSAPP_TEMPLATE_NAME. */
  templateName?: string;
  vars: WhatsAppVars;
}

export type SendWhatsAppResult =
  | { ok: true; providerMessageId?: string; deferred?: boolean }
  | { ok: false; error: string };

/**
 * Render the body for char-budget assertions and the would-send log.
 * The MSG91 API uses positional `var1..varN`; the body shape below mirrors
 * the approved template:
 *   "Hi {ownerName}, your Gojo trial ends in {daysRemaining} days.
 *    You've saved ₹{savingsAmount}. Convert: {conversionUrl}"
 */
export function renderWhatsAppBody(vars: WhatsAppVars): string {
  return `Hi ${vars.ownerName}, your Gojo trial ends in ${vars.daysRemaining} days. You've saved ₹${vars.savingsAmount}. Convert: ${vars.conversionUrl}`;
}

function providerConfigured(): boolean {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_WHATSAPP_INTEGRATED_NUMBER);
}

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const body = renderWhatsAppBody(params.vars);
  const templateName = params.templateName ?? env.MSG91_WHATSAPP_TEMPLATE_NAME;

  if (!providerConfigured()) {
    console.info(
      `[whatsapp] would-send to=${params.to} template=${templateName} body="${body}"`,
    );
    return { ok: true, deferred: true };
  }

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en', policy: 'deterministic' },
        ...(env.MSG91_WHATSAPP_NAMESPACE ? { namespace: env.MSG91_WHATSAPP_NAMESPACE } : {}),
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: params.vars.ownerName },
              { type: 'text', text: String(params.vars.daysRemaining) },
              { type: 'text', text: String(params.vars.savingsAmount) },
              { type: 'text', text: params.vars.conversionUrl },
            ],
          },
        ],
      },
    },
    recipients: [
      {
        mobiles: params.to.replace(/^\+/, ''),
      },
    ],
  };

  try {
    const res = await fetch(MSG91_WHATSAPP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_AUTH_KEY!,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `msg91 ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => null)) as { request_id?: string } | null;
    return data?.request_id
      ? { ok: true, providerMessageId: data.request_id }
      : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
