export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `+91 XXXXXX${digits.slice(-4)}`;
}
