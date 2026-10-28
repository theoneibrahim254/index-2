const PRODUCTS = {
  'chef-bundle': { name: "Chef's Bundle", amount: 6500 },
  'silk-spoon-set': { name: 'Silk Spoon Set', amount: 1900 },
  'storage-canisters': { name: 'Storage Canisters', amount: 3200 }
};

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[\s()+-]/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^\+?254[17]\d{8}$/.test(digits)) return digits.replace(/^\+/, '');
  return null;
}

function getTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function getApiBase() {
  if (process.env.MPESA_ENV === 'production') return 'https://api.safaricom.co.ke';
  if (!process.env.MPESA_ENV || process.env.MPESA_ENV === 'sandbox') {
    return 'https://sandbox.safaricom.co.ke';
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST to request an M-Pesa prompt.' });
  }

  const origin = req.headers.origin;
  let allowedOrigin;
  try {
    allowedOrigin = new URL(process.env.SITE_URL).origin;
  } catch {
    return sendJson(res, 503, { error: 'The site origin is not configured correctly.' });
  }
  if (!origin || origin !== allowedOrigin) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  const product = PRODUCTS[req.body?.productId];
  const phone = normalizePhone(req.body?.phone);
  if (!product || !phone) {
    return sendJson(res, 400, { error: 'Choose a valid product and Kenyan M-Pesa phone number.' });
  }

  const apiBase = getApiBase();
  const {
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PARTY_B,
    MPESA_TRANSACTION_TYPE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL
  } = process.env;
  const validTransactionTypes = ['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'];
  if (!apiBase || !MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PARTY_B || !validTransactionTypes.includes(MPESA_TRANSACTION_TYPE) || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    return sendJson(res, 503, { error: 'M-Pesa is not configured yet. Please contact the shop.' });
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(MPESA_CALLBACK_URL);
    if (callbackUrl.protocol !== 'https:') throw new Error('HTTPS is required');
  } catch {
    return sendJson(res, 503, { error: 'The M-Pesa callback URL is not configured correctly.' });
  }

  try {
    const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const tokenResponse = await fetch(`${apiBase}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(10000)
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) {
      return sendJson(res, 502, { error: 'Could not connect to M-Pesa. Please try again later.' });
    }

    const timestamp = getTimestamp();
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const stkResponse = await fetch(`${apiBase}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: MPESA_TRANSACTION_TYPE,
        Amount: product.amount,
        PartyA: phone,
        PartyB: MPESA_PARTY_B,
        PhoneNumber: phone,
        CallBackURL: callbackUrl.toString(),
        AccountReference: 'KitchenPro',
        TransactionDesc: product.name
      }),
      signal: AbortSignal.timeout(15000)
    });
    const stkBody = await stkResponse.json();
    if (!stkResponse.ok || String(stkBody.ResponseCode) !== '0') {
      return sendJson(res, 502, { error: 'M-Pesa did not accept the prompt. Please check the number and try again.' });
    }

    return sendJson(res, 202, {
      message: 'Prompt sent. Approve it on your phone only if the product and amount are correct.',
      checkoutRequestId: stkBody.CheckoutRequestID
    });
  } catch {
    return sendJson(res, 502, { error: 'M-Pesa is temporarily unavailable. Please try again later.' });
  }
};