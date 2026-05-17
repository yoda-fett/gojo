// @ts-nocheck
import {
  checkSubscriptionGate,
  deleteCatalogItem,
  prisma,
  updateCatalogItem,
} from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const PatchBody = z
  .object({
    stateVersion: z.number().int().min(0),
    name: z.string().min(1).max(64).optional(),
    unit: z.string().min(1).max(32).optional(),
    roomTypeId: z.string().min(1).optional(),
    expectedQtyPerStay: z.number().int().min(0).max(1000).optional().nullable(),
    restockThreshold: z.number().int().min(0).max(1000).optional().nullable(),
    linenCategory: z.enum(['ROUTINE', 'PERIODIC']).optional().nullable(),
    totalOwned: z.number().int().min(0).max(100000).optional().nullable(),
    minPoolSize: z.number().int().min(0).max(100000).optional().nullable(),
  })
  .passthrough();

const DeleteBody = z.object({ stateVersion: z.number().int().min(0).optional() }).optional();

function idFromContext(context: unknown) {
  return (context as { params?: Promise<{ id: string }> })?.params;
}

function parsePatch(raw: unknown) {
  const result = PatchBody.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError('VALIDATION_ERROR', 'Invalid catalog item patch', 422, {
      details: { field: issue?.path.join('.') || 'body', reason: issue?.code },
    });
  }
  return result.data;
}

export const PATCH = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'CATALOG_ITEM_WRITE', prisma);
  const { id } = (await idFromContext(context)) ?? { id: '' };
  const body = parsePatch(await req.json());
  const item = await prisma.$transaction((tx) => updateCatalogItem(actor, tx, id, body));
  return NextResponse.json({ ok: true, item });
}, 'OWNER');

export const DELETE = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'CATALOG_ITEM_WRITE', prisma);
  const { id } = (await idFromContext(context)) ?? { id: '' };
  const body = DeleteBody.parse(await req.json().catch(() => undefined));
  const item = await prisma.$transaction((tx) => deleteCatalogItem(actor, tx, id, body?.stateVersion));
  return NextResponse.json({ ok: true, item });
}, 'OWNER');
