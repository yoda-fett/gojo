// @ts-nocheck
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createIssueReport, parseIssueReportInput } from '@gojo/db';
import { AppError } from '@gojo/types';

import { readHousekeepingActor } from '@/lib/auth';

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
    fields[key] = key === 'qty' || key === 'voiceSeconds' ? Number(value) : value;
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

export async function POST(req: Request) {
  try {
    const actor = await readHousekeepingActor(await cookies());
    if (!actor) throw new AppError('UNAUTHORIZED', 'Sign in required', 401);
    const { fields, evidence } = await parseRequest(req);
    const body = parseIssueReportInput(fields);
    const result = await createIssueReport(actor, body, evidence, req.headers.get('idempotency-key') ?? '');
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }
    console.error('[housekeeping issue-reports] Unhandled error:', error);
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
