# KitchenPro M-Pesa STK Push with IntaSend

This branch contains the Vercel version of the KitchenPro site and uses IntaSend's M-Pesa STK Push API. The `main` branch remains separate from the Vercel project.

## Deploy on Vercel

1. Import `theoneibrahim254/index-2` into Vercel and select the `mpesa-stk` branch.
2. Set `SITE_URL` to the exact Vercel production origin.
3. Add `INTASEND_SECRET_KEY` as a Vercel Secret. Use an IntaSend test key (`ISSecretKey_test_...`) for sandbox; a live key (`ISSecretKey_live_...`) switches requests to live payments.
4. Create an IntaSend webhook for `collection_event`, set its endpoint to `https://your-vercel-domain.vercel.app/api/intasend/webhook`, and save a strong random challenge in Vercel as `INTASEND_WEBHOOK_CHALLENGE`.
5. Redeploy after adding or changing environment variables. Do not put credentials in HTML, Git, chat, or `SITE_URL`.

Required variables: `SITE_URL`, `INTASEND_SECRET_KEY`, and `INTASEND_WEBHOOK_CHALLENGE`.

Use the official IntaSend dashboard to create sandbox/live keys and configure the webhook. IntaSend uses the same API base URL for both environments; the key prefix selects test or live mode.

## Payment behavior

The API uses a server-side allowlist for product prices and accepts Kenyan mobile numbers in local or `254` format. A `202` response means IntaSend created the invoice, not that the customer paid. The webhook verifies its configured challenge and re-checks invoice status, but does not store orders or fulfill them. Only fulfill orders after matching an `api_ref`, amount and currency against a persistent order record and confirming the invoice is `COMPLETE`. Configure request rate limiting for `/api/mpesa` in Vercel before live use to reduce unsolicited prompt abuse.

The GitHub Pages site does not support `/api/mpesa`; use the Vercel deployment for STK Push.