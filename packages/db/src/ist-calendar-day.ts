export const IST_OFFSET_MINUTES = 330;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function istDateKey(value = new Date()) {
  const shifted = new Date(value.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function istDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+05:30`);
}

export function todayInIST(value = new Date()) {
  return istDateFromKey(istDateKey(value));
}
