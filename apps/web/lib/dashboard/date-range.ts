import { formatISTDateKey, startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'mtd' | 'ytd';

export type DateRange = {
  from: string;
  to: string;
  label: string;
};

function shift(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISTDateKey(date);
}

export function buildRange(preset: RangePreset): DateRange {
  const today = todayIST();

  switch (preset) {
    case 'today':
      return { from: today, to: today, label: 'Today' };
    case 'yesterday': {
      const day = shift(today, -1);
      return { from: day, to: day, label: 'Yesterday' };
    }
    case '7d':
      return { from: shift(today, -6), to: today, label: 'Last 7 days' };
    case '30d':
      return { from: shift(today, -29), to: today, label: 'Last 30 days' };
    case '90d':
      return { from: shift(today, -89), to: today, label: 'Last 90 days' };
    case 'mtd': {
      const [year, month] = today.split('-');
      return { from: `${year}-${month}-01`, to: today, label: 'Month to date' };
    }
    case 'ytd': {
      const [year] = today.split('-');
      return { from: `${year}-01-01`, to: today, label: 'Year to date' };
    }
  }
}

export function parseDateRange(from?: string | null, to?: string | null, fallback: RangePreset = 'today'): DateRange {
  if (from && to) {
    return { from, to, label: `${from} to ${to}` };
  }

  return buildRange(fallback);
}

export function toUtcRange(range: DateRange) {
  return {
    from: startOfIstDayUtc(range.from),
    to: endOfIstDayUtc(range.to),
  };
}

export function listDateKeys(range: DateRange) {
  const keys: string[] = [];
  let cursor = range.from;

  while (cursor <= range.to) {
    keys.push(cursor);
    cursor = shift(cursor, 1);
  }

  return keys;
}

export function priorRange(range: DateRange): DateRange {
  const keys = listDateKeys(range);
  const span = keys.length;
  return {
    from: shift(range.from, -span),
    to: shift(range.to, -span),
    label: `Previous ${span} days`,
  };
}
