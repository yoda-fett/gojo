import type { AuditAction } from '@gojo/types';

type AuditMetadata = Record<string, unknown> | null | undefined;

type AuditRowForSummary = {
  action: string;
  metadata: AuditMetadata;
  fromState: string | null;
  toState: string | null;
};

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? null : `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? null : `${keys.length} field${keys.length === 1 ? '' : 's'}`;
  }
  return null;
}

function firstString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function pickAmount(meta: Record<string, unknown>): string | null {
  const amount = meta.amount ?? meta.value ?? meta.total;
  if (typeof amount === 'number') {
    const currency = typeof meta.currency === 'string' ? meta.currency : 'INR';
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
  return null;
}

function genericSummary(meta: Record<string, unknown>, limit = 3): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (parts.length >= limit) break;
    const formatted = formatValue(value);
    if (formatted === null) continue;
    parts.push(`${humanizeKey(key)}: ${formatted}`);
  }
  return parts.length ? parts.join(' · ') : '';
}

const ACTION_FORMATTERS: Partial<Record<AuditAction, (meta: Record<string, unknown>) => string>> = {
  CHECK_IN: (meta) => firstString(meta, ['guestName', 'guest', 'reservationCode']) ?? '',
  CHECK_OUT: (meta) => {
    const guest = firstString(meta, ['guestName', 'guest']);
    const total = pickAmount(meta);
    return [guest, total].filter(Boolean).join(' · ');
  },
  NO_SHOW_MARKED: (meta) => firstString(meta, ['reservationCode', 'guestName']) ?? '',
  RESERVATION_CANCELLED: (meta) => {
    const code = firstString(meta, ['reservationCode']);
    const reason = firstString(meta, ['reason']);
    return [code, reason].filter(Boolean).join(' · ');
  },
  RESERVATION_AMENDED: (meta) => firstString(meta, ['reservationCode']) ?? '',
  ROOM_REASSIGNED: (meta) => {
    const from = firstString(meta, ['fromRoom', 'fromRoomNumber']);
    const to = firstString(meta, ['toRoom', 'toRoomNumber']);
    return from && to ? `${from} → ${to}` : '';
  },
  DISCOUNT_APPLIED: (meta) => {
    const amount = pickAmount(meta);
    const reason = firstString(meta, ['reason']);
    return [amount, reason].filter(Boolean).join(' · ');
  },
  RATE_OVERRIDE_BELOW_FLOOR: (meta) => {
    const rate = pickAmount(meta);
    const floor = typeof meta.floor === 'number' ? `floor INR ${meta.floor.toLocaleString('en-IN')}` : null;
    return [rate, floor].filter(Boolean).join(' · ');
  },
  FOLIO_LINE_VOIDED: (meta) => {
    const amount = pickAmount(meta);
    const reason = firstString(meta, ['reason']);
    return [amount, reason].filter(Boolean).join(' · ');
  },
  FOLIO_LINE_REFUNDED: (meta) => pickAmount(meta) ?? '',
  INVOICE_ISSUED: (meta) => {
    const number = firstString(meta, ['invoiceNumber', 'number']);
    const amount = pickAmount(meta);
    return [number, amount].filter(Boolean).join(' · ');
  },
  CREDIT_NOTE_ISSUED: (meta) => {
    const number = firstString(meta, ['creditNoteNumber', 'number']);
    const amount = pickAmount(meta);
    return [number, amount].filter(Boolean).join(' · ');
  },
  GUEST_ID_REVEALED: (meta) => firstString(meta, ['guestName', 'reservationCode']) ?? '',
  AUTH_LOGIN_FAILED: (meta) => firstString(meta, ['phone', 'reason']) ?? '',
  AUDIT_LOG_EXPORTED: (meta) => firstString(meta, ['range', 'count']) ?? '',
  CHANNEL_CONNECTED: (meta) => firstString(meta, ['channelName', 'channel']) ?? '',
  CHANNEL_DISCONNECTED: (meta) => firstString(meta, ['channelName', 'channel']) ?? '',
  CHANNEL_PAUSED_TRIAL_EXPIRY: (meta) => firstString(meta, ['channelName', 'channel']) ?? '',
  CATALOG_ITEM_CREATED: (meta) => firstString(meta, ['itemName', 'name']) ?? '',
  CATALOG_ITEM_UPDATED: (meta) => firstString(meta, ['itemName', 'name']) ?? '',
  CATALOG_ITEM_DELETED: (meta) => firstString(meta, ['itemName', 'name']) ?? '',
  INVENTORY_RESTOCKED: (meta) => {
    const item = firstString(meta, ['itemName', 'name']);
    const qty = typeof meta.quantity === 'number' ? `+${meta.quantity}` : null;
    return [item, qty].filter(Boolean).join(' · ');
  },
  CONSUMPTION_LOG_CREATED: (meta) => firstString(meta, ['itemName', 'name']) ?? '',
  LAUNDRY_ITEMS_OUT: (meta) =>
    typeof meta.count === 'number' ? `${meta.count} item${meta.count === 1 ? '' : 's'} sent` : '',
  LAUNDRY_ITEMS_RECEIVED: (meta) =>
    typeof meta.count === 'number' ? `${meta.count} item${meta.count === 1 ? '' : 's'} received` : '',
  ROOM_ASSIGNED: (meta) => firstString(meta, ['roomNumber', 'staffName']) ?? '',
  ROOM_REASSIGNED_STAFF: (meta) => {
    const from = firstString(meta, ['fromStaff']);
    const to = firstString(meta, ['toStaff']);
    return from && to ? `${from} → ${to}` : firstString(meta, ['roomNumber']) ?? '';
  },
  ROOM_BLOCKED: (meta) => firstString(meta, ['blockType', 'reason']) ?? '',
  ROOM_BLOCK_LIFTED: (meta) => firstString(meta, ['roomNumber']) ?? '',
  HOUSEKEEPING_STATUS_UPDATED: () => '', // fromState→toState fallback handles this cleanly
  SUBSCRIPTION_STATUS_CHANGED: () => '', // fromState→toState fallback
};

export function formatAuditSummary(row: AuditRowForSummary): string {
  const action = row.action as AuditAction;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;

  const formatter = ACTION_FORMATTERS[action];
  if (formatter) {
    const formatted = formatter(meta).trim();
    if (formatted) return formatted;
  }

  if (row.fromState && row.toState) {
    return `${row.fromState} → ${row.toState}`;
  }

  if (Object.keys(meta).length > 0) {
    const generic = genericSummary(meta);
    if (generic) return generic;
  }

  return '—';
}
