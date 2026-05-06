export function toPaise(amount: number | string) {
  return Math.round(Number(amount) * 100);
}

export function fromPaise(paise: number) {
  return paise / 100;
}

export function formatInr(amount: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
}
