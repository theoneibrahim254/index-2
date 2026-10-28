const PESAPAL_BASE_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3/api',
  production: 'https://pay.pesapal.com/v3/api'
};

function getConfig() {
  const baseUrl = PESAPAL_BASE_URLS[process.env.PESAPAL_ENV];
  const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_NOTIFICATION_ID, SITE_URL } = process.env;
  if (!baseUrl || !PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET || !PESAPAL_NOTIFICATION_ID || !SITE_URL) {
    return null;
  }
  try {
    const site = new URL(SITE_URL);
    if (site.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return {
    baseUrl,
    consumerKey: PESAPAL_CONSUMER_KEY,
    consumerSecret: PESAPAL_CONSUMER_SECRET,
    notificationId: PESAPAL_NOTIFICATION_ID,
    siteUrl: SITE_URL
  };
}

async function getToken(config) {
  const response = await fetch(`${config.baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: config.consumerKey,
      consumer_secret: config.consumerSecret
    }),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.token) throw new Error('Pesapal authentication failed.');
  return result.token;
}

async function getTransactionStatus(config, token, orderTrackingId) {
  const url = new URL(`${config.baseUrl}/Transactions/GetTransactionStatus`);
  url.searchParams.set('orderTrackingId', orderTrackingId);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.payment_status_description) throw new Error('Pesapal status lookup failed.');
  return result;
}

module.exports = { getConfig, getToken, getTransactionStatus };