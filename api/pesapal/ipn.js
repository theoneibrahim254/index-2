const { getConfig, getToken, getTransactionStatus } = require('../../lib/pesapal');

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const config = getConfig();
  if (!config) return sendJson(res, 503, { error: 'Pesapal is not configured.' });

  const payload = req.method === 'POST' ? req.body || {} : req.query || {};
  const orderTrackingId = String(payload.OrderTrackingId || '');
  const merchantReference = String(payload.OrderMerchantReference || '');
  const notificationType = String(payload.OrderNotificationType || '');
  if (!orderTrackingId || !merchantReference || notificationType !== 'IPNCHANGE') {
    return sendJson(res, 400, { error: 'Invalid Pesapal IPN payload.' });
  }

  try {
    const token = await getToken(config);
    const status = await getTransactionStatus(config, token, orderTrackingId);
    if (status.merchant_reference !== merchantReference) {
      return sendJson(res, 400, { error: 'Pesapal order reference did not match.' });
    }

    return sendJson(res, 200, {
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference: merchantReference,
      status: 200
    });
  } catch {
    return sendJson(res, 500, {
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference: merchantReference,
      status: 500
    });
  }
};