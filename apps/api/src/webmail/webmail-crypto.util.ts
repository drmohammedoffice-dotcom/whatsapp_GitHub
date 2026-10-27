import { randomBytes, randomInt } from 'crypto';

const LOCAL_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const PASS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASS_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASS_DIGITS = '23456789';
const PASS_SYMBOLS = '!@#$%&*-_+?';

export function generateLocalPart(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += LOCAL_CHARS[randomInt(LOCAL_CHARS.length)]!;
  }
  if (/^\d/.test(out)) out = `u${out.slice(1)}`;
  return out;
}

const CUSTOMER_LOCAL_RE = /^customer(\d+)$/i;

/** Parse highest customerN from local-parts / emails (customer1, customer2, …). */
export function nextCustomerSequence(locals: string[]): number {
  let max = 0;
  for (const raw of locals) {
    const local = String(raw ?? '')
      .trim()
      .toLowerCase()
      .split('@')[0]!;
    const match = CUSTOMER_LOCAL_RE.exec(local);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export function customerLocalPart(n: number): string {
  return `customer${Math.max(1, Math.floor(n))}`;
}

/** كلمة مرور قوية: 20 حرفاً مع أحرف كبيرة/صغيرة وأرقام ورموز */
export function generateStrongPassword(length = 20): string {
  const pools = [PASS_UPPER, PASS_LOWER, PASS_DIGITS, PASS_SYMBOLS];
  const required = pools.map((pool) => pool[randomInt(pool.length)]!);
  const all = pools.join('');
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(all[randomInt(all.length)]!);
  }
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

export function normalizeLocalPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, '')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 64);
}

export function randomTokenHint(): string {
  return randomBytes(4).toString('hex');
}
