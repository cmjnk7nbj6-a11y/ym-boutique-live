export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const order = req.body || {};
  const to = process.env.ORDER_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY or ORDER_NOTIFY_EMAIL not configured' });

  const customBuilds = (order.items || []).filter(i => i.buildData).map(i => `${i.name}: ${i.buildData.charms?.map(c => c.name).join(', ')}`).join('\n');
  const text = `New Y&M Boutique order\n\nCustomer: ${order.customer?.name}\nContact: ${order.customer?.email}\nTotal: $${Number(order.total || 0).toFixed(2)}\nShipping: ${order.customer?.method} - ${order.customer?.address || ''} ${order.customer?.city || ''} ${order.customer?.state || ''} ${order.customer?.zip || ''}\n\nItems:\n${(order.items || []).map(i => `- ${i.name} $${Number(i.price || 0).toFixed(2)}`).join('\n')}\n\nCustom Builds:\n${customBuilds || 'None'}\n`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Y&M Boutique <onboarding@resend.dev>', to, subject: `New Y&M Boutique Order - ${order.customer?.name || 'Customer'}`, text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(500).json({ error: data });
  return res.status(200).json({ ok: true, data });
}
