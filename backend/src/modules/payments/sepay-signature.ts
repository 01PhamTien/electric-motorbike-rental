import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNED_FIELDS = [
  'order_amount', 'merchant', 'currency', 'operation',
  'order_description', 'order_invoice_number', 'customer_id',
  'payment_method', 'success_url', 'error_url', 'cancel_url',
] as const;

export type SePayCheckoutFields = Record<string, string>;

export function createSePaySignature(fields: SePayCheckoutFields, secretKey: string): string {
  const signed = SIGNED_FIELDS
    .filter(field => fields[field] !== undefined && fields[field] !== null && fields[field] !== '' && fields[field] !== '0')
    .map(field => field + '=' + fields[field]);
  return createHmac('sha256', secretKey).update(signed.join(',')).digest('base64');
}

export function safeSecretEquals(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
