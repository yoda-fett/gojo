// @ts-nocheck
import {
  checkSubscriptionGate,
  deleteRoomAssignment,
  prisma,
  reassignRoomAssignment,
} from '@gojo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const PatchBody = z.object({
  staffUserId: z.string().min(1),
  stateVersion: z.number().int().min(0),
});

const DeleteBody = z.object({ stateVersion: z.number().int().min(0).optional() }).optional();

function idFromContext(context: unknown) {
  return (context as { params?: Promise<{ id: string }> })?.params;
}

export const PATCH = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'room_assignment.update', prisma);
  const params = await idFromContext(context);
  const body = PatchBody.parse(await req.json());
  const assignment = await prisma.$transaction((tx) => reassignRoomAssignment(actor, tx, params?.id ?? '', body));
  return NextResponse.json({ ok: true, assignment });
}, ['OWNER', 'MANAGER']);

export const DELETE = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'room_assignment.delete', prisma);
  const params = await idFromContext(context);
  const body = DeleteBody.parse(await req.json().catch(() => undefined));
  const assignment = await prisma.$transaction((tx) => deleteRoomAssignment(actor, tx, params?.id ?? '', body?.stateVersion));
  return NextResponse.json({ ok: true, assignment });
}, ['OWNER', 'MANAGER']);
