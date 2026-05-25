// Supabase Storage wrapper for issue-report evidence (voice clips, photos).
// Uses the server-side secret key — must only be imported from server code
// (API routes / server components), never from the client bundle.
//
// Bucket: `issue-reports` (private). Objects are organised by property + report
// id so the dashboard can mint signed URLs with the same path it received.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'issue-reports';

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set for issue evidence uploads.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type EvidenceKind = 'voice' | 'photo';

function safeExt(filename: string, fallback: string) {
  const m = filename.match(/\.([a-z0-9]{1,8})$/i);
  return m && m[1] ? `.${m[1].toLowerCase()}` : fallback;
}

// Path shape: <propertyId>/<reportId>/<kind><ext>
// Predictable layout: dashboard can clean up by property or by report.
export function evidencePath(propertyId: string, reportId: string, kind: EvidenceKind, filename: string) {
  const fallback = kind === 'voice' ? '.webm' : '.jpg';
  return `${propertyId}/${reportId}/${kind}${safeExt(filename, fallback)}`;
}

// Upload a File (multipart form) to the bucket. Returns the object path
// (NOT a URL — we mint signed URLs at read time per D1=private).
export async function uploadEvidence(
  file: File,
  opts: { propertyId: string; reportId: string; kind: EvidenceKind },
): Promise<string> {
  const path = evidencePath(opts.propertyId, opts.reportId, opts.kind, file.name);
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || (opts.kind === 'voice' ? 'audio/webm' : 'image/jpeg'),
    upsert: true,
  });
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  return path;
}

// Mint a short-lived signed URL for a stored object. Default 1 hour TTL.
// Returns null if the path isn't in the bucket (handles legacy stub paths).
export async function signEvidenceUrl(path: string | null | undefined, expirySeconds = 3600): Promise<string | null> {
  if (!path) return null;
  // Legacy stub paths (`/uploads/issue-reports/...`) predate Supabase Storage;
  // skip them silently — they'd 404 anyway. Cleanup job removes them eventually.
  if (path.startsWith('/uploads/')) return null;
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expirySeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

// Bulk variant — used by the dashboard pending-review endpoint.
export async function signEvidenceUrls(
  paths: Array<string | null | undefined>,
  expirySeconds = 3600,
): Promise<Array<string | null>> {
  return Promise.all(paths.map((p) => signEvidenceUrl(p, expirySeconds)));
}

// Delete a single object. Used by the cleanup cron.
export async function deleteEvidence(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove(paths);
}
