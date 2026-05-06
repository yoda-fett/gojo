// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').filter(Boolean).slice(-1)[0];
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { lines: true } });
  if (!invoice || invoice.propertyId !== actor.propertyId) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Invoice not found' }, { status: 404 });
  }
  const creditNote = await prisma.invoice.findFirst({
    where: { propertyId: actor.propertyId, parentInvoiceId: invoice.id, type: 'CREDIT_NOTE' },
    include: { lines: true },
  });
  return NextResponse.json({ invoice, creditNote });
}, ['OWNER', 'MANAGER']);
