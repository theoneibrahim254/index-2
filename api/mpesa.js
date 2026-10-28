const crypto = require('crypto');

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

  const secretKey = process.env.INTASEND_SECRET_KEY;
  if (!secretKey || !/^ISSecretKey_(test|live)_/.test(secretKey)) {
    return sendJson(res, 503, { error: 'M-Pesa payments are not configured yet. Please contact the shop.' });
  }

  try {
    const response = await fetch('https://api.intasend.com/api/v1/payment/mpesa-stk-push/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        amount: product.amount,
        phone_number: phone,
        api_ref: `kitchenpro-${productIdRef(product)}-${crypto.randomUUID()}`
      }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => ({}));
    const invoice = result.invoice || result;

    if (!response.ok || !invoice.invoice_id) {
      return sendJson(res, 502, { error: 'IntaSend could not accept the payment prompt. Please try again later.' });
    }

    return sendJson(res, 202, {
      message: 'Prompt sent. Approve it on your phone only if the product and amount are correct.',
      invoiceId: invoice.invoice_id,
      state: invoice.state || 'PENDING'
    });
  } catch {
    return sendJson(res, 502, { error: 'The payment service is temporarily unavailable. Please try again later.' });
  }
};

function productIdRef(product) {
  return Object.keys(PRODUCTS).find((productId) => PRODUCTS[productId] === product) || 'order';
}