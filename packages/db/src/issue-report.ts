import { AppError, type Actor } from '@gojo/types';
import { z } from 'zod';

import { prisma } from './client.js';
import { withIdempotency } from './idempotency.js';
import { scopedClient } from './scoped-client.js';
import { checkSubscriptionGate } from './subscription-gate.js';
import type { DbClient } from './types.js';
import { writeAuditLog } from './audit-log.js';

export const issueCategories = ['DAMAGE_IN_ROOM', 'MISSING_ITEM', 'DAMAGED_RETURN', 'OTHER'] as const;
export type IssueCategory = (typeof issueCategories)[number];
export type IssueEntryContext = 'COLD' | 'MISSING_FROM_ROOM' | 'DAMAGED_ON_RETURN';
export type IssueAttributionStream = 'ROOM_SHORTAGE' | 'LAUNDRY_SHORTAGE' | 'OTHER';

export type IssueReportInput =
  | {
      entryContext: 'COLD';
      category: IssueCategory;
      roomId?: string | null;
      catalogItemId?: string | null;
      vendorName?: string | null;
      textNote?: string | null;
    }
  | {
      entryContext: 'MISSING_FROM_ROOM';
      category: 'MISSING_ITEM';
      roomId: string;
      catalogItemId: string;
      qty: number;
      textNote?: string | null;
    }
  | {
      entryContext: 'DAMAGED_ON_RETURN';
      category: 'DAMAGED_RETURN';
      catalogItemId: string;
      qty: number;
      vendorName: string;
      textNote?: string | null;
    };

export type IssueEvidence = {
  voiceFileUrl?: string | null;
  photoFileUrl?: string | null;
  voiceSeconds?: number | null;
};

const optionalText = (max: number) => z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().max(max).optional().nullable());

const ColdSchema = z
  .object({
    entryContext: z.literal('COLD'),
    category: z.enum(issueCategories),
    roomId: optionalText(128),
    catalogItemId: optionalText(128),
    vendorName: optionalText(80),
    textNote: optionalText(280),
  })
  .strict();

const MissingFromRoomSchema = z
  .object({
    entryContext: z.literal('MISSING_FROM_ROOM'),
    category: z.literal('MISSING_ITEM'),
    roomId: z.string().trim().min(1),
    catalogItemId: z.string().trim().min(1),
    qty: z.coerce.number().int().min(1),
    textNote: optionalText(280),
  })
  .strict();

const DamagedOnReturnSchema = z
  .object({
    entryContext: z.literal('DAMAGED_ON_RETURN'),
    category: z.literal('DAMAGED_RETURN'),
    catalogItemId: z.string().trim().min(1),
    qty: z.coerce.number().int().min(1),
    vendorName: z.string().trim().min(1).max(80),
    textNote: optionalText(280),
  })
  .strict();

export const IssueReportBodySchema = z.discriminatedUnion('entryContext', [
  ColdSchema,
  MissingFromRoomSchema,
  DamagedOnReturnSchema,
]);

function validation(message: string, field: string, reason: string) {
  return new AppError('VALIDATION_ERROR', message, 422, { details: { field, reason } });
}

export function attributionStreamForEntryContext(entryContext: IssueEntryContext): IssueAttributionStream {
  if (entryContext === 'MISSING_FROM_ROOM') return 'ROOM_SHORTAGE';
  if (entryContext === 'DAMAGED_ON_RETURN') return 'LAUNDRY_SHORTAGE';
  return 'OTHER';
}

export function parseIssueReportInput(raw: unknown): IssueReportInput {
  const result = IssueReportBodySchema.safeParse(raw);
  if (result.success) {
    const body = result.data;
    if (body.entryContext === 'COLD') {
      return {
        ...body,
        roomId: body.roomId ?? null,
        catalogItemId: body.catalogItemId ?? null,
        vendorName: body.vendorName ?? null,
        textNote: body.textNote ?? null,
      };
    }
    if (body.entryContext === 'MISSING_FROM_ROOM') {
      return { ...body, textNote: body.textNote ?? null };
    }
    return { ...body, textNote: body.textNote ?? null };
  }

  const issue = result.error.issues[0];
  const field = issue?.path.join('.') || (issue?.code === 'unrecognized_keys' ? issue.keys[0] : 'body');
  const reason =
    issue?.code === 'unrecognized_keys'
      ? 'FIELD_NOT_ALLOWED_FOR_ENTRY_CONTEXT'
      : issue?.code === 'invalid_union_discriminator'
        ? 'INVALID_ENTRY_CONTEXT'
        : issue?.code ?? 'INVALID_PAYLOAD';
  throw validation('Invalid issue report payload', field ?? 'body', reason);
}

export async function enqueueWriteOffReviewAlert(tx: DbClient, propertyId: string) {
  const pendingCount = await tx.issueReport.count({
    where: { propertyId, status: 'PENDING_REVIEW', deletedAt: null },
  });
  const existing = await tx.alert.findFirst({
    where: { propertyId, alertType: 'WRITE_OFF_REVIEW_PENDING', status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  const message = `${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} awaiting review`;
  if (existing) {
    await tx.alert.update({ where: { id: existing.id }, data: { message, updatedAt: new Date() } });
    return existing.id;
  }
  const alert = await tx.alert.create({
    data: {
      propertyId,
      alertType: 'WRITE_OFF_REVIEW_PENDING',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      message,
      entityType: 'ISSUE_REPORT_QUEUE',
    },
  });
  return alert.id;
}

export async function createIssueReport(
  actor: Actor,
  input: IssueReportInput,
  evidence: IssueEvidence,
  idempotencyKey: string,
) {
  await checkSubscriptionGate(actor, 'issue.report', prisma);

  if (!idempotencyKey) throw validation('idempotency-key is required', 'idempotency-key', 'REQUIRED');
  if ((evidence.voiceSeconds ?? 0) > 60) throw validation('voice clip must be 60 seconds or less', 'voiceFile', 'TOO_LONG');
  if (!evidence.voiceFileUrl && !input.textNote) throw validation('voice or text required', 'evidence', 'NEED_VOICE_OR_TEXT');

  return withIdempotency(`issue-report:v1:${actor.propertyId}:${actor.userId}:${idempotencyKey}`, prisma, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const db = scopedClient(actor, tx);
      const attributionStream = attributionStreamForEntryContext(input.entryContext);
      const report = (await db.issueReport.create({
        data: {
          propertyId: actor.propertyId,
          entryContext: input.entryContext,
          category: input.category,
          attributionStream,
          roomId: 'roomId' in input ? input.roomId ?? null : null,
          catalogItemId: 'catalogItemId' in input ? input.catalogItemId ?? null : null,
          qty: 'qty' in input ? input.qty : null,
          vendorName: 'vendorName' in input ? input.vendorName ?? null : null,
          voiceFileUrl: evidence.voiceFileUrl ?? null,
          photoFileUrl: evidence.photoFileUrl ?? null,
          textNote: input.textNote ?? null,
          reportedBy: actor.userId,
          status: 'PENDING_REVIEW',
        },
      })) as { id: string };

      await tx.pendingReview.create({
        data: {
          propertyId: actor.propertyId,
          reviewType: attributionStream,
          status: 'PENDING',
          roomId: 'roomId' in input ? input.roomId ?? null : null,
          catalogItemId: 'catalogItemId' in input ? input.catalogItemId ?? null : null,
          qty: 'qty' in input ? input.qty : null,
          reason: 'Issue report submitted by housekeeping',
          metadata: { issueReportId: report.id, entryContext: input.entryContext, category: input.category },
          createdBy: actor.userId,
        },
      });

      await writeAuditLog(tx, actor, {
        action: 'ISSUE_REPORTED',
        entityType: 'ISSUE_REPORT',
        entityId: report.id,
        metadata: {
          entryContext: input.entryContext,
          attributionStream,
          category: input.category,
          roomId: 'roomId' in input ? input.roomId ?? null : null,
          catalogItemId: 'catalogItemId' in input ? input.catalogItemId ?? null : null,
          qty: 'qty' in input ? input.qty : null,
          vendorName: 'vendorName' in input ? input.vendorName ?? null : null,
        },
      });

      await enqueueWriteOffReviewAlert(tx, actor.propertyId);
      return { ok: true, id: report.id, attributionStream };
    });
    return result;
  });
}

export function listPendingIssueReports(
  actor: Actor,
  filters: { status?: string | null; attributionStream?: IssueAttributionStream | null } = {},
) {
  const db = scopedClient(actor, prisma);
  return db.issueReport.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.attributionStream ? { attributionStream: filters.attributionStream } : {}),
    },
    orderBy: { reportedAt: 'desc' },
  });
}
