export function normalizeTelegramPhone(raw: string): string {
  let value = raw.trim().replace(/[\s\-()]/g, '');
  if (value.startsWith('*')) value = `+${value.slice(1)}`;
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (!value.startsWith('+')) value = `+${value.replace(/^0+/, '')}`;
  return value;
}

export function isValidTelegramPhone(value: string): boolean {
  return /^\+[0-9]{8,15}$/.test(value);
}
