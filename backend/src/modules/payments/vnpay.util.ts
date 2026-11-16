import { createHmac, timingSafeEqual } from 'node:crypto';

export type VnPayParams = Record<string, string>;

function encode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export function vnpayCanonicalString(params: VnPayParams): string {
  return Object.keys(params)
    .filter(key => key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort()
    .map(key => `${encode(key)}=${encode(params[key])}`)
    .join('&');
}

export function signVnPayParams(params: VnPayParams, secret: string): string {
  return createHmac('sha512', secret).update(vnpayCanonicalString(params), 'utf8').digest('hex');
}

export function verifyVnPaySignature(params: VnPayParams, secret: string): boolean {
  const supplied = params.vnp_SecureHash;
  if (!supplied || !/^[a-f0-9]{128}$/i.test(supplied)) return false;
  const expected = signVnPayParams(params, secret);
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(supplied, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function buildVnPayUrl(baseUrl: string, params: VnPayParams, secret: string): string {
  const signed = { ...params, vnp_SecureHash: signVnPayParams(params, secret) };
  const query = Object.keys(signed).sort().map(key => `${encode(key)}=${encode(signed[key])}`).join('&');
  return `${baseUrl}?${query}`;
}

export function formatVnPayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return value('year') + value('month') + value('day') + value('hour') + value('minute') + value('second');
}

export function toVnPayAmount(amount: string | number): string {
  const value = Number(amount);
  const scaled = value * 100;
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-7) {
    throw new Error('VNPay amount must be a positive VND amount with at most two decimal places.');
  }
  return String(Math.round(scaled));
}
