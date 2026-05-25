// Hotfix-10 §3 — POST /api/internal/cleanup-evidence
//
// Daily cron entry point: deletes Supabase Storage objects for IssueReports
// that have been reviewed (approved/rejected) more than 90 days ago, and
// nulls the URL columns. The report row is kept for audit history; only
// the heavy media bytes drop.
//
// Auth: `Authorization: Bearer <CRON_SECRET>` — same pattern as
// /api/internal/housekeeping-cadence. External scheduler (cron-job.org)
// hits this once per day.

import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { env } from '@/env';
import { deleteEvidence } from '@/lib/issue-evidence-storage';

const RETENTION_DAYS = 90;

export async function POST(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing cron credentials' },
      { status: 401 },
    );
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Eligible: reviewed (status APPROVED or REJECTED) AND reviewedAt older
  // than cutoff AND still has at least one evidence URL we manage.
  const reports = await prisma.issueReport.findMany({
    where: {
      reviewedAt: { lt: cutoff, not: null },
      OR: [
        { voiceFileUrl: { not: null } },
        { photoFileUrl: { not: null } },
      ],
    },
    select: { id: true, voiceFileUrl: true, photoFileUrl: true },
  });

  const pathsToDelete: string[] = [];
  const idsToClear: string[] = [];
  for (const report of reports) {
    // Only delete Supabase-managed paths. Legacy `/uploads/...` stubs are
    // nulled out without a remote DELETE (nothing to delete remotely).
    if (report.voiceFileUrl && !report.voiceFileUrl.startsWith('/uploads/')) {
      pathsToDelete.push(report.voiceFileUrl);
    }
    if (report.photoFileUrl && !report.photoFileUrl.startsWith('/uploads/')) {
      pathsToDelete.push(report.photoFileUrl);
    }
    idsToClear.push(report.id);
  }

  let storageDeleted = 0;
  if (pathsToDelete.length > 0) {
    try {
      await deleteEvidence(pathsToDelete);
      storageDeleted = pathsToDelete.length;
    } catch (error) {
      console.error('[cleanup-evidence] Storage delete failed:', error);
      // Continue to null the DB columns even if storage delete fails — the
      // dashboard sign call gracefully returns null for missing objects.
    }
  }

  let rowsCleared = 0;
  if (idsToClear.length > 0) {
    const result = await prisma.issueReport.updateMany({
      where: { id: { in: idsToClear } },
      data: { voiceFileUrl: null, photoFileUrl: null },
    });
    rowsCleared = result.count;
  }

  return NextResponse.json({
    retentionDays: RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    reportsScanned: reports.length,
    storageDeleted,
    rowsCleared,
  });
}
