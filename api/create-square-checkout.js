import crypto from 'crypto';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const order = req.body || {};
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const env = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  if (!accessToken || !locationId) return res.status(400).json({ error: 'Square API is not configured. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to your .env file.' });

  const endpoint = env === 'production' ? 'https://connect.squareup.com/v2/online-checkout/payment-links' : 'https://connect.squareupsandbox.com/v2/online-checkout/payment-links';
  const amount = Math.round(Number(order.total || 0) * 100);
  const body = {
    idempotency_key: order.id || crypto.randomUUID(),
    order: {
      location_id: locationId,
      line_items: [{ name: `Y&M Boutique Order ${String(order.id || '').slice(0, 8)}`, quantity: '1', base_price_money: { amount, currency: 'USD' } }],
    },
    checkout_options: { redirect_url: `${siteUrl}/#checkout` },
  };
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Square-Version': '2025-04-16' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Square rejected checkout request:', JSON.stringify(data, null, 2));
    return res.status(500).json({ error: 'Square rejected checkout request.', square: data });
  }
  if (!data.payment_link?.url) return res.status(500).json({ error: 'Square did not return a payment link URL.', square: data });
  return res.status(200).json({ paymentLink: data.payment_link.url, square: data });
}
