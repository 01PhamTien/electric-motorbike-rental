export type SePayAllocationPayment = { purpose: 'RENT' | 'DEPOSIT' | string; amount: string | number };

const cents = (value: string | number) => Math.round((Number(value) + Number.EPSILON) * 100);

export function calculateCombinedBookingAllocation(
  rentalAmount: string | number,
  depositAmount: string | number,
  payments: SePayAllocationPayment[],
) {
  const collected = (purpose: 'RENT' | 'DEPOSIT') => payments
    .filter(payment => payment.purpose === purpose)
    .reduce((sum, payment) => sum + cents(payment.amount), 0);
  const rentAmountCents = Math.max(0, cents(rentalAmount) - collected('RENT'));
  const depositAmountCents = Math.max(0, cents(depositAmount) - collected('DEPOSIT'));
  const totalAmountCents = rentAmountCents + depositAmountCents;
  if (![rentAmountCents, depositAmountCents, totalAmountCents].every(Number.isSafeInteger)) {
    throw new Error('Combined SePay allocation exceeds safe integer precision');
  }
  return {
    rentAmountCents,
    depositAmountCents,
    totalAmountCents,
    rentAmount: (rentAmountCents / 100).toFixed(2),
    depositAmount: (depositAmountCents / 100).toFixed(2),
    totalAmount: (totalAmountCents / 100).toFixed(2),
  };
}
