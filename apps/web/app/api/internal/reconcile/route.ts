// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { runReconciliation } from '@/lib/services/reconciliation';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const date = body.date ? new Date(body.date) : new Date();

  const properties = body.propertyId
    ? await prisma.property.findMany({ where: { id: body.propertyId, deletedAt: null } })
    : await prisma.property.findMany({ where: { deletedAt: null } });

  const results = [];
  for (const property of properties) {
    const recon = await runReconciliation({ propertyId: property.id, date });
    results.push({ propertyId: property.id, status: recon.status, discrepancyCount: recon.discrepancyCount });
  }
  return NextResponse.json({ results });
}
