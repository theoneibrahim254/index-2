const crypto = require('crypto');

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const expectedChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
  const receivedChallenge = req.body?.challenge;
  if (!expectedChallenge) {
    return sendJson(res, 503, { error: 'Webhook challenge is not configured.' });
  }

  const expected = Buffer.from(expectedChallenge);
  const received = Buffer.from(typeof receivedChallenge === 'string' ? receivedChallenge : '');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return sendJson(res, 401, { error: 'Invalid webhook challenge.' });
  }

  if (req.body?.topic !== 'collection_event') {
    return sendJson(res, 200, { received: true });
  }

  const invoiceId = req.body?.invoice_id;
  const secretKey = process.env.INTASEND_SECRET_KEY;
  if (!invoiceId || !secretKey) {
    return sendJson(res, 400, { error: 'Invalid collection event.' });
  }

  try {
    const response = await fetch('https://api.intasend.com/api/v1/payment/status/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json().catch(() => ({}));
    const invoice = result.invoice || result;
    if (!response.ok || invoice.invoice_id !== invoiceId || typeof invoice.state !== 'string') {
      return sendJson(res, 502, { error: 'Could not verify the payment event.' });
    }

    return sendJson(res, 200, { received: true, state: invoice.state });
  } catch {
    return sendJson(res, 502, { error: 'Could not verify the payment event.' });
  }
};