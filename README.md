# KitchenPro Pesapal Checkout

This branch contains the Vercel version of the KitchenPro site and uses Pesapal API 3.0 hosted checkout. The `main` branch remains separate from the Vercel project.

## Deploy on Vercel

1. Import `theoneibrahim254/index-2` into Vercel and select the `mpesa-stk` branch.
2. Set `SITE_URL` to the exact Vercel production origin and `PESAPAL_ENV=sandbox` while testing.
3. Add `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, and `PESAPAL_NOTIFICATION_ID` as Vercel Secrets. Use Pesapal sandbox credentials for sandbox; switch `PESAPAL_ENV=production` only after a Pesapal live merchant account is approved.
4. Register `https://your-vercel-domain.vercel.app/api/pesapal/ipn` as a POST IPN with Pesapal and set the returned IPN ID as `PESAPAL_NOTIFICATION_ID`. Register separate IPNs for sandbox and live environments.
5. Redeploy after adding or changing environment variables. Do not put credentials in HTML, Git, chat, or `SITE_URL`.

Required variables: `SITE_URL`, `PESAPAL_ENV`, `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, and `PESAPAL_NOTIFICATION_ID`.

Use the [Pesapal developer portal](https://developer.pesapal.com/) to create API credentials. Sandbox and production use different API base URLs. See the official docs for [authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication), [IPN registration](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl), [order submission](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest), and [transaction status](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus).

## Payment behavior

The API uses a server-side allowlist for product prices, sends the customer to Pesapal's hosted checkout, and verifies return status with Pesapal's transaction-status endpoint. The IPN endpoint verifies status before acknowledging notifications. This version does not persist orders or fulfill them. Before using it as an order-confirmation system, add persistent order storage and match the merchant reference, expected amount, currency, and `COMPLETED` status. Configure request rate limiting for `/api/pesapal` in Vercel before live use.

The GitHub Pages site does not support `/api/pesapal`; use the Vercel deployment for checkout.