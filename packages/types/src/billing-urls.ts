// Story 10.2g: Centralized billing/upgrade URL builders.
// Consumed by:
//   - apps/api/src/workers/trial-nudge.handler.ts (email + WhatsApp vars)
//   - apps/web/components/dashboard/SavingsCardNudge.tsx (CTA href)
//
// Reading `APP_BASE_URL` from process.env keeps the helper environment-aware
// without coupling the type package to a config loader.

const DEFAULT_APP_BASE_URL = 'https://app.gojo.in';

function getBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    DEFAULT_APP_BASE_URL
  );
}

/**
 * URL the trial-conversion CTA points to. Property scoping is encoded
 * in a query param so the upgrade page can pre-fill the right billing
 * context (a future story owns that page).
 */
export function buildUpgradeUrl(propertyId: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}/billing/upgrade?property=${encodeURIComponent(propertyId)}`;
}
