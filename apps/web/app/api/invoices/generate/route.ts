// @ts-nocheck
import { NextResponse } from 'next/server';

import { generateInvoice } from '@gojo/db';

import { withAuth } from '@/lib/auth/api-handler';

export const POST = withAuth(async (req, actor) => {
  const body = await req.json().catch(() => ({}));
  if (!body.folioId) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'folioId is required' }, { status: 400 });
  }
  const invoice = await generateInvoice(actor, {
    folioId: body.folioId,
    nights: Array.isArray(body.nights) ? body.nights : [],
    snapshotExtras: body.snapshotExtras,
  });
  return NextResponse.json(invoice, { status: 201 });
}, ['OWNER', 'MANAGER']);
