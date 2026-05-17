// Story 10.2b: Resend-backed email send service.
// When `RESEND_API_KEY` is unset, falls back to a console "would-send" log
// so worker handlers and tests can run without provider credentials.

import { Resend } from 'resend';

import { env } from '../../env.js';
import { loadTemplate, renderTemplate, type TemplateVars } from './template.js';

export interface SendEmailParams {
  to: string;
  templateSlug: string;
  vars: TemplateVars;
}

export type SendEmailResult =
  | { ok: true; providerMessageId?: string; deferred?: boolean }
  | { ok: false; error: string };

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  if (!env.RESEND_API_KEY) return null;
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Send a templated email via Resend.
 *
 * Never throws — provider errors are caught and returned as
 * `{ ok: false, error }` so a calling worker can record the failure on
 * the run row without killing the queue.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  let rendered;
  try {
    const tpl = loadTemplate(params.templateSlug);
    rendered = renderTemplate(tpl, params.vars);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const client = getResendClient();
  if (!client || !env.RESEND_FROM_EMAIL) {
    console.info(
      `[email] would-send to=${params.to} slug=${params.templateSlug} subject="${rendered.subject}"`,
    );
    return { ok: true, deferred: true };
  }

  try {
    const result = await client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, providerMessageId: result.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Test-only: reset cached client between tests. */
export function resetResendClientForTests(): void {
  resendClient = null;
}
