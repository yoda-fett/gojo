// Calendar-day helpers used for "today in a property's local timezone" queries
// against `@db.Date` columns (date-only).
//
// THE TRAP this file exists to avoid:
//   Prisma serializes JS `Date` → ISO string → Postgres truncates to UTC date
//   for `@db.Date` comparisons. If the Date represents (say) IST midnight on
//   2026-05-24, that's `2026-05-23T18:30:00.000Z` in UTC → Postgres reads
//   `'2026-05-23'`. Every "today" query silently returned yesterday.
//
// Fix: `dateFromKey(key)` returns a Date anchored at **UTC midnight** of the
// key. The UTC date portion equals the key, so it matches @db.Date columns
// correctly regardless of the wall-clock time-of-day in any timezone.
//
// The `*InIST` exports stay as thin convenience wrappers around the generic
// tz-aware versions, hardcoded to `Asia/Kolkata`. New code should prefer
// `dateKeyInTz(tz)` / `todayInTz(tz)` and read the timezone from the property
// row (see `Property.timezone` on the schema).

export const IST_TZ = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * Return today's calendar date in the given IANA timezone as a `YYYY-MM-DD`
 * string. Pure: depends only on `value` and `tz`.
 */
export function dateKeyInTz(value: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/**
 * Build a `Date` whose UTC date equals the supplied key string.
 * Use this when feeding a Date into Prisma for `@db.Date` filters — the
 * UTC-anchored value round-trips correctly through Postgres.
 */
export function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Today's IST date as a `YYYY-MM-DD` key. Equivalent to `dateKeyInTz(now, IST_TZ)`.
 */
export function istDateKey(value: Date = new Date()): string {
  // Preserve the historical offset-shift implementation for byte-identical
  // output. (Intl-based version would also work; this is faster on hot paths
  // and used by tests that compare against fixed Date math.)
  const shifted = new Date(value.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Build a `Date` for the given IST date key. Anchored at UTC midnight so that
 * Prisma `@db.Date` comparisons see the right date.
 *
 * Historical name kept for compatibility — semantically identical to `dateFromKey`.
 */
export function istDateFromKey(dateKey: string): Date {
  return dateFromKey(dateKey);
}

/**
 * Today's date (UTC-anchored, for Prisma `@db.Date`) in IST.
 * Convenience wrapper over `dateFromKey(istDateKey(value))`.
 */
export function todayInIST(value: Date = new Date()): Date {
  return dateFromKey(istDateKey(value));
}

/**
 * Today's date (UTC-anchored) in the given IANA timezone.
 * Prefer this for new code — read the timezone from `Property.timezone`.
 */
export function todayInTz(tz: string, value: Date = new Date()): Date {
  return dateFromKey(dateKeyInTz(value, tz));
}
