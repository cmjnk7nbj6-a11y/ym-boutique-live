# Y&M Boutique v13 — Tray Scanner + Admin Login

## Run locally
```bash
npm install
npm run dev
```

Open: http://localhost:3000

## Hidden admin page
Open:
```
http://localhost:3000/#ym-admin-portal
```

Default admin login:
```
Email: ymboutiqueshop@hotmail.com
Password: Happy2026$
```

You can override these in `.env`:
```
VITE_ADMIN_EMAIL=ymboutiqueshop@hotmail.com
VITE_ADMIN_PASSWORD=Happy2026$
```

## Tray Scanner
Admin → Photo Tray Scanner → Upload tray photos. The app will crop charm candidates from white-background photos. Review each extracted charm, name it, set SKU/price/quantity, and save selected items to inventory.

## Supabase
Add your keys to `.env` and Vercel Environment Variables:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PRODUCT_BUCKET=product-images
```

Run the SQL files in Supabase SQL Editor:
- `supabase/schema.sql`
- `supabase/orders-schema.sql`

## Deploy
Push this folder to GitHub main. Vercel will redeploy automatically.

## v15 changes

- Added an Admin button in the header that opens `/#ym-admin-portal`.
- Added two-step admin login: email/password first, then Supabase email OTP code.
- Fixed inventory edit updates by removing `.single()` from update queries.

### Supabase Auth requirement for admin 2FA

Create a Supabase Auth user for `ymboutiqueshop@hotmail.com` before using email OTP.
If you need to test locally without OTP, set:

```env
VITE_ADMIN_REQUIRE_2FA=false
```
