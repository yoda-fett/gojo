// @ts-nocheck
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createIssueReport, parseIssueReportInput, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { readHousekeepingActor } from '@/lib/auth';
import { uploadEvidence } from '@/lib/issue-evidence-storage';

// Hotfix-10: evidence (voice + photo) is now uploaded to Supabase Storage
// (bucket `issue-reports`, private). Flow:
//   1. Parse multipart form; capture files in memory.
//   2. Create the IssueReport row with null URLs → get the report id.
//   3. Upload files using <propertyId>/<reportId>/<kind><ext> path layout.
//   4. UPDATE the row with the resolved storage paths.
// If step 3/4 fails the report still exists; owner sees "no voice · no photo"
// on the dashboard. Recoverable, not data-loss.
const PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB per D2
const VOICE_MAX_BYTES = 2 * 1024 * 1024;
const VOICE_MAX_SECONDS = 60;

type ParsedRequest = {
  fields: Record<string, unknown>;
  voiceFile: File | null;
  photoFile: File | null;
  voiceSeconds: number | null;
};

async function parseRequest(req: Request): Promise<ParsedRequest> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    // JSON fallback path retained for callers that pass pre-resolved URLs
    // (e.g., test fixtures). Real PWA submits always come via multipart.
    const json = await req.json();
    return {
      fields: { ...json, voiceFileUrl: undefined, photoFileUrl: undefined },
      voiceFile: null,
      photoFile: null,
      voiceSeconds: typeof json.voiceSeconds === 'number' ? json.voiceSeconds : null,
    };
  }

  const form = await req.formData();
  const fields: Record<string, unknown> = {};
  let voiceSeconds: number | null = null;
  for (const [key, value] of form.entries()) {
    if (key === 'voiceFile' || key === 'photoFile') continue;
    if (key === 'voiceSeconds') {
      // voiceSeconds belongs on `evidence`, not on the report body — the body
      // schema is strict and would reject it.
      voiceSeconds = Number(value);
      continue;
    }
    fields[key] = key === 'qty' ? Number(value) : value;
  }
  const voice = form.get('voiceFile');
  const photo = form.get('photoFile');

  if (voice instanceof File) {
    if ((voiceSeconds ?? 0) > VOICE_MAX_SECONDS) {
      throw new AppError('VALIDATION_ERROR', 'voice clip must be 60 seconds or less', 422, {
        details: { field: 'voiceFile', reason: 'TOO_LONG' },
      });
    }
    if (voice.size > VOICE_MAX_BYTES) {
      throw new AppError('VALIDATION_ERROR', 'voice file must be 2MB or less', 422, {
        details: { field: 'voiceFile', reason: 'TOO_LARGE' },
      });
    }
  }
  if (photo instanceof File && photo.size > PHOTO_MAX_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'photo must be 2MB or less', 422, {
      details: { field: 'photoFile', reason: 'TOO_LARGE' },
    });
  }

  return {
    fields,
    voiceFile: voice instanceof File && voice.size > 0 ? voice : null,
    photoFile: photo instanceof File && photo.size > 0 ? photo : null,
    voiceSeconds,
  };
}

export async function POST(req: Request) {
  try {
    const actor = await readHousekeepingActor(await cookies());
    if (!actor) throw new AppError('UNAUTHORIZED', 'Sign in required', 401);
    const { fields, voiceFile, photoFile, voiceSeconds } = await parseRequest(req);
    const body = parseIssueReportInput(fields);

    // Step 1 — create the report with null evidence URLs. We need the report id
    // before we can upload (storage path includes it).
    // createIssueReport requires *something* in evidence to pass its own
    // "voice or text required" guard. We pretend voice is present when a file
    // is attached; resolved path replaces null in step 2.
    const pretendVoicePresent = voiceFile ? '__pending_upload__' : null;
    const result = await createIssueReport(
      actor,
      body,
      { voiceFileUrl: pretendVoicePresent, photoFileUrl: null, voiceSeconds },
      req.headers.get('idempotency-key') ?? '',
    );

    // Step 2 — upload + update. Best-effort: if upload fails, the row remains
    // with the placeholder (or null for photo). Surfaces cleanly to owner.
    if (voiceFile || photoFile) {
      const evidenceUpdate: { voiceFileUrl?: string | null; photoFileUrl?: string | null } = {};
      try {
        if (voiceFile) {
          evidenceUpdate.voiceFileUrl = await uploadEvidence(voiceFile, {
            propertyId: actor.propertyId,
            reportId: result.id,
            kind: 'voice',
          });
        } else if (pretendVoicePresent) {
          // No voice file but we set the placeholder — null it out.
          evidenceUpdate.voiceFileUrl = null;
        }
        if (photoFile) {
          evidenceUpdate.photoFileUrl = await uploadEvidence(photoFile, {
            propertyId: actor.propertyId,
            reportId: result.id,
            kind: 'photo',
          });
        }
      } catch (uploadError) {
        console.error('[housekeeping issue-reports] Evidence upload failed:', uploadError);
        // Null out the placeholder so the dashboard doesn't try to sign a
        // non-existent path.
        if (pretendVoicePresent && evidenceUpdate.voiceFileUrl === undefined) {
          evidenceUpdate.voiceFileUrl = null;
        }
      }

      if (Object.keys(evidenceUpdate).length > 0) {
        await prisma.issueReport.update({
          where: { id: result.id },
          data: evidenceUpdate,
        });
      }
    } else if (pretendVoicePresent) {
      // Shouldn't happen, but defensive: clear the placeholder if no upload.
      await prisma.issueReport.update({
        where: { id: result.id },
        data: { voiceFileUrl: null },
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }
    console.error('[housekeeping issue-reports] Unhandled error:', error);
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
