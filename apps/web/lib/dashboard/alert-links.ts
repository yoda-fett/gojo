export function alertHref(alert: { alertType?: string | null; entityType?: string | null; entityId?: string | null }) {
  if (alert.alertType === 'RESTOCK_REQUIRED' && alert.entityId) return `/housekeeping/inventory?tab=amenities&item=${alert.entityId}`;
  if (alert.alertType === 'POOL_BELOW_MIN' && alert.entityId) return `/housekeeping/inventory?tab=linens&item=${alert.entityId}`;
  if (alert.alertType === 'WRITE_OFF_REVIEW_PENDING') return '/housekeeping/inventory?tab=pending';
  if (alert.entityType === 'RESERVATION' && alert.entityId) return `/reservations/${alert.entityId}`;
  if (alert.entityId) return `/reservations/${alert.entityId}`;
  return null;
}
