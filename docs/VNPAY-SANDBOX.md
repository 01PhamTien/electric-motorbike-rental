# VNPay Sandbox integration

VoltGo integrates VNPay using the official redirect payment flow (API version 2.1.0, HMAC-SHA512). The integration is disabled by default and does not move real money in local development.

## Flow

1. An authenticated customer requests checkout for their own booking. The backend derives the remaining deposit/rent amount from the booking and settled payment ledger; the browser cannot submit an amount.
2. The backend creates a unique pending attempt and redirects the customer to the VNPay Sandbox payment URL.
3. VNPay calls the public IPN endpoint. The backend verifies HMAC-SHA512, merchant code, transaction reference and amount before writing a settled TRANSFER ledger entry.
4. The browser Return URL only redirects back to the booking page. It never marks a payment successful; IPN is authoritative.
5. A successful deposit payment is recorded in the ledger but does not automatically confirm the booking. Existing station staff confirmation remains in place.
5. Duplicate IPN notifications are idempotent. A pending attempt is separate from the settled payment ledger.

## Environment

Copy `.env.example` to `.env` and configure:

- `VNPAY_ENABLED=true`
- `VNPAY_TMN_CODE`: merchant Terminal ID from the VNPay Sandbox portal.
- `VNPAY_HASH_SECRET`: Sandbox secret key. Never commit this value.
- `VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`
- `VNPAY_RETURN_URL`: public HTTPS URL ending in `/api/payments/vnpay/return`.
- `VNPAY_IPN_URL`: public HTTPS URL ending in `/api/payments/vnpay/ipn`.

The backend must be reachable from VNPay over HTTPS for IPN. For local testing, expose the backend through a temporary HTTPS tunnel and use that exact public hostname in the Sandbox merchant configuration. Configure the IPN URL in the VNPay Sandbox merchant portal. Do not use localhost for IPN.

Apply the SQL Server migration in a disposable/test database first:

```bash
cd backend
npm run migration:run:mssql
npm run migration:check:mssql
npm test
npm run test:mssql
```

Do not run migrations against VoltGoDB until the migration has been reviewed and a verified backup exists.

## API

- `POST /api/payments/vnpay/bookings/:id/checkout` (customer JWT): body contains `purpose` (`DEPOSIT` or `RENT`) and an `idempotencyKey`. The amount is computed by the server.
- `GET /api/payments/vnpay/ipn` (public VNPay callback): verifies and records the result.
- `GET /api/payments/vnpay/return` (public browser return): redirects to the customer booking page; it does not trust browser parameters.
- `GET /api/payments/vnpay/status/:txnRef` (customer JWT): returns the authenticated customer's attempt status.

## Security and rollout

- Never expose `VNPAY_HASH_SECRET` to the frontend or commit real credentials.
- Do not treat the browser Return URL as proof of payment.
- Only a valid IPN with response code and transaction status `00` settles the ledger.
- Amounts are sent to VNPay in VND minor units (VND amount multiplied by 100), as required by the VNPay specification.
- Refunds remain an internal ledger workflow in this phase; automated VNPay refunds are not enabled. Staff manual collection is blocked while a matching VNPay checkout is still pending. If a late verified success arrives after an older attempt expired or the amount is no longer due, the received funds are still recorded and flagged for manual reconciliation.
- Production credentials, production IPN registration, operational alerting and reconciliation must be completed separately before enabling live payments.
