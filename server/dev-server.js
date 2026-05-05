import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

// Local development server:
// - Serves the Vite website
// - Serves secure backend API routes for Square + notifications
// Run with: npm run dev

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

function squareEndpoint() {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com/v2/online-checkout/payment-links'
    : 'https://connect.squareupsandbox.com/v2/online-checkout/payment-links';
}

app.post('/api/create-square-checkout', async (req, res) => {
  try {
    const order = req.body || {};
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

    if (!accessToken || !locationId) {
      return res.status(400).json({
        error: 'Square API is not configured. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to your .env file, then restart npm run dev.',
      });
    }

    const totalCents = Math.max(1, Math.round(Number(order.total || 0) * 100));
    const safeOrderId = String(order.id || crypto.randomUUID()).slice(0, 12);

    const lineItems = Array.isArray(order.items) && order.items.length
      ? order.items.map((item) => ({
          name: String(item.name || 'Y&M Boutique Item').slice(0, 120),
          quantity: '1',
          base_price_money: {
            amount: Math.max(1, Math.round(Number(item.price || 0) * 100)),
            currency: 'USD',
          },
          note: item.buildData ? 'Custom build item. See saved order preview in admin.' : undefined,
        }))
      : [{
          name: `Y&M Boutique Order ${safeOrderId}`,
          quantity: '1',
          base_price_money: { amount: totalCents, currency: 'USD' },
        }];

    if (Number(order.shipping || 0) > 0) {
      lineItems.push({
        name: `Shipping - ${order.customer?.method || 'Standard'}`,
        quantity: '1',
        base_price_money: { amount: Math.round(Number(order.shipping) * 100), currency: 'USD' },
      });
    }

    const payload = {
      idempotency_key: order.id || crypto.randomUUID(),
      order: {
        location_id: locationId,
        reference_id: safeOrderId,
        line_items: lineItems,
      },
      checkout_options: {
        redirect_url: `${siteUrl}/#checkout`,
        ask_for_shipping_address: true,
      },
    };

    const response = await fetch(squareEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-04-16',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('\nSQUARE CHECKOUT REJECTED');
      console.error('HTTP status:', response.status);
      console.error(JSON.stringify(data, null, 2));
      return res.status(500).json({
        error: 'Square rejected checkout request. Check the VS Code terminal for the exact Square error.',
        square: data,
      });
    }

    if (!data.payment_link?.url) {
      console.error('\nSQUARE CHECKOUT CREATED WITHOUT URL');
      console.error(JSON.stringify(data, null, 2));
      return res.status(500).json({ error: 'Square did not return a payment link URL.', square: data });
    }

    console.log('Square checkout link created:', data.payment_link.url);
    return res.json({ paymentLink: data.payment_link.url, square: data });
  } catch (error) {
    console.error('Square checkout error:', error);
    return res.status(500).json({ error: error.message || 'Square checkout failed.' });
  }
});

app.post('/api/notify-order', async (req, res) => {
  // Local placeholder. Production can use Resend/Vercel route.
  const order = req.body || {};
  console.log('\nNEW Y&M ORDER SUBMITTED');
  console.log('Customer:', order.customer?.name, order.customer?.email);
  console.log('Total:', order.total);
  console.log('Items:', order.items?.map((i) => i.name).join(', '));
  return res.json({ ok: true, message: 'Order notification logged locally.' });
});

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
});

app.use(vite.middlewares);

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`\nY&M Boutique running: http://localhost:${port}`);
  console.log('Local backend APIs are active at /api/create-square-checkout and /api/notify-order');
});
