// @ts-nocheck
import {
  checkSubscriptionGate,
  createCatalogItem,
  listCatalogItems,
  prisma,
} from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const AmenitySchema = z
  .object({
    itemType: z.literal('AMENITY'),
    roomTypeId: z.string().min(1),
    name: z.string().min(1).max(64),
    unit: z.string().min(1).max(32),
    expectedQtyPerStay: z.number().int().min(0).max(1000),
    restockThreshold: z.number().int().min(0).max(1000).optional().nullable(),
  })
  .strict();

const LinenSchema = z
  .object({
    itemType: z.literal('LINEN'),
    name: z.string().min(1).max(64),
    unit: z.string().min(1).max(32),
    linenCategory: z.enum(['ROUTINE', 'PERIODIC']),
    totalOwned: z.number().int().min(0).max(100000),
    minPoolSize: z.number().int().min(0).max(100000).optional().nullable(),
  })
  .strict();

const Body = z.discriminatedUnion('itemType', [AmenitySchema, LinenSchema]);

function parseBody(raw: unknown) {
  const result = Body.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new AppError('VALIDATION_ERROR', 'Invalid catalog item payload', 422, {
    details: {
      field: issue?.path.join('.') || (issue?.code === 'unrecognized_keys' ? issue.keys[0] : 'body'),
      reason: issue?.code === 'unrecognized_keys' ? 'FIELD_NOT_ALLOWED_FOR_ITEM_TYPE' : issue?.code,
    },
  });
}

export const GET = withAuth(async (req, actor) => {
  const params = new URL(req.url).searchParams;
  const itemType = params.get('itemType') === 'LINEN' ? 'LINEN' : 'AMENITY';
  const roomTypeId = params.get('roomTypeId');
  const items = await listCatalogItems(actor, prisma, { itemType, roomTypeId });
  return NextResponse.json({ items });
}, 'OWNER');

export const POST = withAuth(async (req, actor) => {
  await checkSubscriptionGate(actor, 'CATALOG_ITEM_WRITE', prisma);
  const body = parseBody(await req.json());
  const item = await prisma.$transaction((tx) => createCatalogItem(actor, tx, body));
  return NextResponse.json({ ok: true, item }, { status: 201 });
}, 'OWNER');
