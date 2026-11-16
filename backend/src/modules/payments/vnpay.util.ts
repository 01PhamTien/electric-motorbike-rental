import { createHmac, timingSafeEqual } from 'node:crypto';

export type VnPayParams = Record<string, string>;

export function buildVnPayHashData(params: VnPayParams): string {
  return Object.keys(params).sort()
    .map(key => key + '=' + params[key])
    .join('&');
}

export function signVnPayParams(params: VnPayParams, secret: string): string {
  return createHmac('sha512', secret).update(buildVnPayHashData(params), 'utf8').digest('hex');
}

export function verifyVnPaySignature(params: VnPayParams, secret: string): boolean {
  const supplied = params.vnp_SecureHash;
  if (!supplied || !/^[a-f0-9]{128}$/i.test(supplied)) return false;
  const unsigned: VnPayParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
      unsigned[key] = value;
    }
  }
  const expected = Buffer.from(signVnPayParams(unsigned, secret), 'hex');
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function formatVnPayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return part('year') + part('month') + part('day') + part('hour') + part('minute') + part('second');
}
