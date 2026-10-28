# KitchenPro M-Pesa STK Push

This branch contains a Vercel version of the KitchenPro site with a Daraja STK Push endpoint. The `main` branch remains the current GitHub Pages site.

## Deploy on Vercel

1. Import `theoneibrahim254/index-2` into Vercel and select the `mpesa-stk` branch.
2. Deploy once to obtain a Vercel URL, then set the environment variables below in Vercel Project Settings. Add `MPESA_CALLBACK_URL` using that site's `/api/mpesa/callback` URL and redeploy.
3. Keep `MPESA_ENV=sandbox` while testing with Safaricom Daraja sandbox credentials. Use production credentials and `MPESA_ENV=production` only after Safaricom has enabled the shortcode and STK Push product.
4. Do not put credentials in HTML, Git, chat, or `SITE_URL`. Add each secret directly in Vercel's private Environment Variables interface.

Required variables: `SITE_URL`, `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PARTY_B`, `MPESA_TRANSACTION_TYPE`, `MPESA_PASSKEY`, and `MPESA_CALLBACK_URL`.

`SITE_URL` must be the exact deployed origin, such as `https://your-site.vercel.app`. The callback URL must be a public HTTPS URL.

For a Paybill, set `MPESA_TRANSACTION_TYPE=CustomerPayBillOnline` and use the Paybill number for `MPESA_PARTY_B`. For a Till, set `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and use the Till number for `MPESA_PARTY_B`. Confirm these values with the Safaricom Daraja app configuration.

## Payment behavior

The API uses a server-side allowlist for product prices and accepts Kenyan mobile numbers in local or `254` format. A `202` response means Safaricom accepted the STK request, not that the customer paid. The callback endpoint acknowledges callbacks but does not store or reconcile them. This is a prompt-only integration; add a persistent order/payment store and callback signature/transaction validation before using it as an order-confirmation system. Configure request rate limiting for `/api/mpesa` in Vercel before production to reduce unsolicited prompt abuse.

The live GitHub Pages site does not support `/api/mpesa`; use the Vercel deployment for STK Push.