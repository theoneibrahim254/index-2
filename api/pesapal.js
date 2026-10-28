const crypto = require('crypto');
const { getConfig, getToken, getTransactionStatus } = require('../lib/pesapal');

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
  if (/^0[17]\d{8}$/.test(digits)) return digits;
  if (/^\+?254[17]\d{8}$/.test(digits)) return `0${digits.replace(/^\+/, '').slice(3)}`;
  return null;
}

function isAllowedOrigin(origin, siteUrl, requireOrigin = false) {
  try {
    const allowed = new URL(siteUrl).origin;
    return (!requireOrigin && !origin) || origin === allowed;
  } catch {
    return false;
  }
}

function productFromReference(reference) {
  return Object.entries(PRODUCTS).find(([productId]) => reference.startsWith(`KP-${productId}-`))?.[1] || null;
}

module.exports = async function handler(req, res) {
  const config = getConfig();
  if (!config) return sendJson(res, 503, { error: 'Pesapal is not configured yet. Please contact the shop.' });

  if (req.method === 'GET') {
    if (!isAllowedOrigin(req.headers.origin, config.siteUrl)) {
      return sendJson(res, 403, { error: 'Request origin is not allowed.' });
    }

    const orderTrackingId = String(req.query?.orderTrackingId || '');
    const merchantReference = String(req.query?.merchantReference || '');
    const product = productFromReference(merchantReference);
    if (!orderTrackingId || !product) {
      return sendJson(res, 400, { error: 'Pesapal order details are invalid.' });
    }

    try {
      const token = await getToken(config);
      const status = await getTransactionStatus(config, token, orderTrackingId);
      if (
        status.merchant_reference !== merchantReference ||
        Number(status.amount) !== product.amount ||
        status.currency !== 'KES'
      ) {
        return sendJson(res, 400, { error: 'Pesapal order details did not match.' });
      }
      return sendJson(res, 200, {
        paymentStatus: String(status.payment_status_description).toUpperCase(),
        amount: status.amount,
        currency: status.currency
      });
    } catch {
      return sendJson(res, 502, { error: 'Could not verify the payment with Pesapal.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Use POST to create checkout or GET to check payment status.' });
  }

  if (!isAllowedOrigin(req.headers.origin, config.siteUrl, true)) {
    return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  }

  const productId = String(req.body?.productId || '');
  const product = PRODUCTS[productId];
  const phone = normalizePhone(req.body?.phone);
  const fullName = String(req.body?.fullName || '').trim().replace(/\s+/g, ' ');
  if (!product || !phone || !fullName || fullName.length > 100) {
    return sendJson(res, 400, { error: 'Choose a valid product and enter your name and Kenyan phone number.' });
  }

  try {
    const token = await getToken(config);
    const merchantReference = `KP-${productId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const nameParts = fullName.split(' ');
    const firstName = nameParts.shift();
    const lastName = nameParts.join(' ') || firstName;
    const callbackUrl = new URL('/', config.siteUrl);
    const cancellationUrl = new URL('/', config.siteUrl);
    cancellationUrl.searchParams.set('payment', 'cancelled');

    const order = {
      id: merchantReference,
      currency: 'KES',
      amount: product.amount,
      description: product.name,
      callback_url: callbackUrl.toString(),
      cancellation_url: cancellationUrl.toString(),
      notification_id: config.notificationId,
      billing_address: {
        phone_number: phone,
        country_code: 'KE',
        first_name: firstName,
        last_name: lastName
      }
    };
    const response = await fetch(`${config.baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.redirect_url || !result.order_tracking_id) {
      return sendJson(res, 502, { error: 'Pesapal could not create checkout. Please try again later.' });
    }

    return sendJson(res, 200, { redirectUrl: result.redirect_url });
  } catch {
    return sendJson(res, 502, { error: 'The payment service is temporarily unavailable. Please try again later.' });
  }
};