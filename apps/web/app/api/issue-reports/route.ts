// @ts-nocheck
import { createIssueReport, listPendingIssueReports, parseIssueReportInput } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

const PHOTO_MAX_BYTES = 500 * 1024;
const VOICE_MAX_SECONDS = 60;

async function parseRequest(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    const json = await req.json();
    return {
      fields: json,
      evidence: {
        voiceFileUrl: json.voiceFileUrl ?? null,
        photoFileUrl: json.photoFileUrl ?? null,
        voiceSeconds: typeof json.voiceSeconds === 'number' ? json.voiceSeconds : null,
      },
    };
  }

  const form = await req.formData();
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key === 'voiceFile' || key === 'photoFile') continue;
    if (key === 'qty' || key === 'voiceSeconds') fields[key] = Number(value);
    else fields[key] = value;
  }

  const voice = form.get('voiceFile');
  const photo = form.get('photoFile');
  if (voice instanceof File && Number(fields.voiceSeconds ?? 0) > VOICE_MAX_SECONDS) {
    throw new AppError('VALIDATION_ERROR', 'voice clip must be 60 seconds or less', 422, {
      details: { field: 'voiceFile', reason: 'TOO_LONG' },
    });
  }
  if (photo instanceof File && photo.size > PHOTO_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'photo must be 500KB or less', 422, {
      details: { field: 'photoFile', reason: 'TOO_LARGE' },
    });
  }

  const stamp = Date.now();
  return {
    fields,
    evidence: {
      voiceFileUrl: voice instanceof File && voice.size > 0 ? `/uploads/issue-reports/${stamp}-${voice.name}` : null,
      photoFileUrl: photo instanceof File && photo.size > 0 ? `/uploads/issue-reports/${stamp}-${photo.name}` : null,
      voiceSeconds: typeof fields.voiceSeconds === 'number' ? fields.voiceSeconds : null,
    },
  };
}

export const GET = withAuth(async (req, actor) => {
  const params = new URL(req.url).searchParams;
  const reports = await listPendingIssueReports(actor, {
    status: params.get('status') ?? 'PENDING_REVIEW',
    attributionStream: params.get('attributionStream') as never,
  });
  return NextResponse.json({ reports });
}, ['OWNER', 'MANAGER']);

export const POST = withAuth(async (req, actor) => {
  const { fields, evidence } = await parseRequest(req);
  const body = parseIssueReportInput(fields);
  const result = await createIssueReport(actor, body, evidence, req.headers.get('idempotency-key') ?? '');
  return NextResponse.json(result, { status: 201 });
}, ['HOUSEKEEPING', 'OWNER', 'MANAGER']);
