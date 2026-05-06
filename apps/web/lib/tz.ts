import { formatInTimeZone } from 'date-fns-tz';

export const IST_TIMEZONE = 'Asia/Kolkata';

export function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

export function formatIST(value: Date | string | number, pattern = 'EEEE, dd MMM yyyy') {
  return formatInTimeZone(toDate(value), IST_TIMEZONE, pattern);
}

export function formatISTTime(value: Date | string | number) {
  return formatInTimeZone(toDate(value), IST_TIMEZONE, 'hh:mm a');
}

export function formatISTDateKey(value: Date | string | number) {
  return formatInTimeZone(toDate(value), IST_TIMEZONE, 'yyyy-MM-dd');
}

export function startOfIstDayUtc(value: Date | string | number) {
  const key = formatISTDateKey(value);
  return new Date(`${key}T00:00:00+05:30`);
}

export function endOfIstDayUtc(value: Date | string | number) {
  const key = formatISTDateKey(value);
  return new Date(`${key}T23:59:59.999+05:30`);
}

export function todayIST() {
  return formatISTDateKey(new Date());
}
