# SePay Sandbox and Production

VoltGo supports two explicitly selected SePay environments. The default remains Sandbox.

## Environment variables

Configure credentials only in the backend runtime environment (never commit real values):

```dotenv
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID_SANDBOX=
SEPAY_SECRET_KEY_SANDBOX=
SEPAY_IPN_SECRET_SANDBOX=

SEPAY_MERCHANT_ID_PRODUCTION=
SEPAY_SECRET_KEY_PRODUCTION=
SEPAY_IPN_SECRET_PRODUCTION=

SEPAY_PUBLIC_URL=https://<public-backend-host>
```

The older `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, and `SEPAY_IPN_SECRET` aliases are accepted only as Sandbox fallbacks. Production never falls back to Sandbox credentials.

## Checkout hosts

- Sandbox: `https://pay-sandbox.sepay.vn/v1/checkout/init`
- Production: `https://pay.sepay.vn/v1/checkout/init`

Set `SEPAY_ENV=production` only after copying the Production Merchant ID and Merchant Secret Key from SePay's Go Live screen. Set the Production IPN authentication secret separately to the value configured for the Production IPN endpoint. The Merchant Secret Key and IPN Secret are different credentials.

## Go-live checklist

1. Link a real bank account in SePay.
2. Complete Sandbox testing.
3. Switch the SePay Payment Gateway to Production and obtain the LIVE Merchant ID and Secret Key.
4. Configure the Production IPN URL as `https://<public-backend-host>/api/payments/sepay/ipn` and choose `SECRET_KEY` authentication.
5. Set the same Production IPN secret in `SEPAY_IPN_SECRET_PRODUCTION`.
6. Add the Production merchant credentials to `SEPAY_MERCHANT_ID_PRODUCTION` and `SEPAY_SECRET_KEY_PRODUCTION`.
7. Confirm callback URLs use the public HTTPS backend base URL in `SEPAY_PUBLIC_URL`.
8. Set `SEPAY_ENV=production` during a controlled release window.

## Safety

- Do not put Production credentials in Git, chat, screenshots, or frontend variables.
- Do not switch the environment while a customer checkout is in progress.
- Sandbox invoices and Production invoices are isolated. A pending Sandbox invoice cannot be paid through Production; create a new checkout after switching.
- IPN is the sole authority for recording payment. A browser return URL never marks an invoice paid.
- Make the first Production test a low-value payment that you initiate and can reconcile in the bank statement.
- Refunds are not automatically executed by this integration.
