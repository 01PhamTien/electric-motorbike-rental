# SePay Sandbox integration

VoltGo integrates the SePay Payment Gateway in **Sandbox only**. Sandbox checkout uses the official form endpoint and does not move real money.

## Environment

Add these values to the backend runtime environment (never commit real values):

```dotenv
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID=
SEPAY_SECRET_KEY=
SEPAY_IPN_SECRET=
```

- `SEPAY_MERCHANT_ID` and `SEPAY_SECRET_KEY`: copy the Sandbox credentials from SePay Dashboard → Cổng thanh toán → Đăng ký → Bắt đầu ngay → Sandbox.
- `SEPAY_IPN_SECRET`: create a separate secret in Cổng thanh toán → Cấu hình → IPN and select `SECRET_KEY` authentication.
- Use the Sandbox checkout host `https://pay-sandbox.sepay.vn/v1/checkout/init`. Do not use Production credentials or hosts.

## SePay dashboard setup

1. Register at https://my.sepay.vn/register.
2. Open Cổng thanh toán → Đăng ký → Bắt đầu ngay.
3. Choose Sandbox and copy the Merchant ID and Secret Key immediately. SePay displays the merchant Secret Key only once.
4. Configure IPN URL as `https://<public-api-host>/api/payments/sepay/ipn` (adjust the API global prefix if deployment differs).
5. Set IPN authentication to `SECRET_KEY` and configure the same value as `SEPAY_IPN_SECRET`.
6. Use HTTPS. Local development needs a temporary HTTPS tunnel such as Cloudflare Tunnel or ngrok.

## Application flow

- Customer calls `POST /api/payments/sepay/bookings/:id/checkout` with `{ "purpose": "DEPOSIT" }` or `{ "purpose": "RENT" }`.
- Backend verifies booking ownership and remaining amount, creates a pending attempt, then returns signed form fields.
- Frontend POSTs the returned fields to the Sandbox checkout URL.
- The browser return URL is informational only. It never marks an order paid.
- SePay sends IPN. Backend validates `X-Secret-Key`, invoice, VND currency, amount, `ORDER_PAID`, `CAPTURED`, and `APPROVED`, then records a unique SEPAY ledger transaction.

## Important

- Never commit Merchant Secret Key or IPN Secret.
- Sandbox credentials are isolated from Production.
- IPN is the only source of payment confirmation; a success redirect is not proof of payment.
- Refunds are not automatically executed by this integration. Refunds remain an operator-controlled workflow until a separately approved provider refund API integration is implemented.
