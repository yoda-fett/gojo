// @ts-nocheck
import { NextResponse } from 'next/server';

import { createCreditNote } from '@gojo/db';

import { withAuth } from '@/lib/auth/api-handler';

export const POST = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.indexOf('invoices') + 1];
  const body = await req.json().catch(() => ({}));
  if (!body.reason || !Array.isArray(body.adjustedLines) || body.adjustedLines.length === 0) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'reason and adjustedLines[] required' },
      { status: 400 },
    );
  }
  const creditNote = await createCreditNote(actor, {
    originalInvoiceId: id,
    reason: body.reason,
    adjustedLines: body.adjustedLines,
  });
  return NextResponse.json(creditNote, { status: 201 });
}, ['OWNER', 'MANAGER']);
