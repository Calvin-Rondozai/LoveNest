# LoveNest API

The backend for the LoveNest mobile app and admin dashboard: accounts, products, orders and payments. It also serves the admin dashboard at `/admin` and the legal pages at `/legal`.

| | |
|---|---|
| Runtime | Node.js 20 (TypeScript, ES modules) |
| Web framework | Hono 4 on `@hono/node-server` |
| Auth | Better Auth 1.7: email and password, 6-digit email codes, admin roles, suspension, Expo, Google |
| Database | Turso (libSQL / SQLite) via Drizzle ORM; a local SQLite file in development |
| Email | Resend |
| Photos | Cloudinary |
| Payments | Paynow (EcoCash, OneMoney) |
| Hosting | Render free web service + UptimeRobot |

## What it does

- **Accounts**: sign-up (Terms acceptance required and recorded), sign-in, Google sign-in, 6-digit password reset codes by email, change password, delete account, 30-day sessions.
- **Admin users API**: list, create (with a temporary password the user must change), rename, change role, suspend or reactivate (signs them out), delete. You can never remove your own admin access or the last admin.
- **Catalog**: public categories and visible products for the app; admins create, edit, hide and delete products and upload photos (type checked by file signature, max 5 MB, stored on Cloudinary).
- **Checkout**: prices, totals and stock come from the database only. Stock is reserved in the same transaction as the order, so the last item can't be sold twice. Every checkout carries an idempotency key, so a retry never creates a second order.
- **Payments**: EcoCash and OneMoney through Paynow express checkout. An order is only marked paid after a hash-verified Paynow message with the exact amount. Cash on delivery is marked paid when delivered.
- **Order progress**: admins move orders one step at a time (or cancel, which returns stock) with an optional note; customers see each step and note in the app.

## Run it locally

```bash
cd server
npm install
cp .env.example .env            # then edit .env
npx auth secret                 # paste the output into BETTER_AUTH_SECRET
npm run db:migrate
npm run db:seed                 # categories, starter products, first admin from SEED_ADMIN_*
npm run dev                     # http://localhost:3000
```

- Health: http://localhost:3000/health
- Admin dashboard: http://localhost:3000/admin
- Legal pages: http://localhost:3000/legal

Without the optional keys, development still works: emails (reset codes) print in the terminal, photos are stored in `data/uploads`, and payments use a **Paynow simulator** with Paynow's test numbers: `0771111111` pays after 5 seconds, `0772222222` after 15, `0773333333` cancels, `0774444444` fails with insufficient balance.

**Production refuses to start** unless Resend, Cloudinary and Paynow are configured, so a live shop can never silently fake payments or lose reset emails.

### Running the mobile app against your PC

In the project root, create `.env` from `.env.example` and set `EXPO_PUBLIC_API_URL`:
- Android emulator: `http://10.0.2.2:3000`
- Phone on the same Wi-Fi: `http://<your PC IP>:3000` (find it with `ipconfig`)

Restart `npx expo start` after changing `.env`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm test` | 37 tests against a throwaway database (auth, checkout, stock, payments, Paynow hashes, admin rules, security) |
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Production build and start (migrations, and seeding if `SEED_ADMIN_*` is set, run on start) |
| `npm run db:generate` | Create a migration after changing `src/db/app-schema.ts` |
| `npm run db:migrate` / `npm run db:seed` | Apply migrations / seed (both safe to re-run) |
| `npm run auth:schema` | Regenerate `src/db/auth-schema.ts` after changing Better Auth plugins or fields |

## Going live: step by step

None of these services asks for a credit card. Do them in this order; each step says which settings to copy.

### 1. Turso (database)

1. Sign up at [turso.tech](https://turso.tech) with GitHub.
2. Create a database named `lovenest`, location **Frankfurt** (closest to Render's Frankfurt region).
3. Open the database and copy its URL (`libsql://lovenest-<you>.turso.io`) into `DATABASE_URL`.
4. Create a token (Generate Token, read and write) and copy it into `DATABASE_AUTH_TOKEN`.

### 2. Resend (emails)

1. Sign up at [resend.com](https://resend.com).
2. API Keys > Create, with "Sending access". Copy it into `RESEND_API_KEY`.
3. To email customers you must verify a domain you own (Domains > Add, then add the DNS records it shows). Then set `EMAIL_FROM`, for example `LoveNest <no-reply@yourdomain.com>`. Until a domain is verified, Resend only delivers to your own account email.

### 3. Cloudinary (product photos)

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Dashboard > API Keys: copy Cloud name, API Key and API Secret into `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.

### 4. Paynow (payments)

1. Register at [paynow.co.zw](https://www.paynow.co.zw) and add your business bank account for payouts.
2. Receive Payments > New Integration (type: "3rd Party Shopping Cart or Link"). Copy the Integration ID and Integration Key into `PAYNOW_INTEGRATION_ID` and `PAYNOW_INTEGRATION_KEY`.
3. While the integration is in **test mode**, set `PAYNOW_AUTH_EMAIL` to your Paynow login email and use the test numbers above. Ask Paynow to set it live when you are ready, then remove `PAYNOW_AUTH_EMAIL`.
4. Paynow posts payment results to `https://<your Render URL>/api/payments/paynow/result`; nothing to configure, the server sends this URL with each payment.

### 5. Google sign-in (optional, needs your Android package name)

1. [console.cloud.google.com](https://console.cloud.google.com) > new project "LoveNest".
2. APIs and Services > OAuth consent screen: External, app name LoveNest, your support email, logo, and the links to `/legal/privacy.html` and `/legal/terms.html`. Scopes: email, profile, openid only.
3. Credentials > Create OAuth client ID > **Web application**. Copy the client ID and secret into the server's `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and the client ID into the app's `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Credentials > Create OAuth client ID > **Android**: your package name (`ANDROID_PACKAGE` in the app's `.env`) and the SHA-1 fingerprint from `npx eas credentials` (or `npx expo run:android` debug keystore for testing).
5. Google sign-in works in a development or release build, not in Expo Go.

### 6. Render (hosting)

1. Push the repository to GitHub.
2. [render.com](https://render.com) > sign up with GitHub > New > **Blueprint** > pick the LoveNest repo. Render reads `render.yaml` (Node 20, Frankfurt, free plan, health check, generated `BETTER_AUTH_SECRET`).
3. Fill in the settings it asks for:
   - `BETTER_AUTH_URL`: the service URL Render shows, e.g. `https://lovenest-api.onrender.com` (you can set it after the first deploy, then redeploy)
   - everything from steps 1 to 5
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: your first admin (a strong password)
4. Deploy. Check `https://<url>/health` shows `{"ok":true,"db":"up","payments":"live"}`.
5. Sign in at `https://<url>/admin`, then **delete `SEED_ADMIN_PASSWORD`** from Render's Environment settings.

### 7. UptimeRobot (keep the free server awake)

1. [uptimerobot.com](https://uptimerobot.com) > Add New Monitor > HTTP(s).
2. URL `https://<your Render URL>/health`, interval 5 minutes.

Render's free plan sleeps after 15 minutes without traffic; the monitor prevents that so Paynow results and customers never hit a cold server. When the shop earns, Render's paid plan removes the need for this.

### 8. Point the app and legal links at production

- App `.env` (or EAS environment variables): `EXPO_PUBLIC_API_URL=https://<your Render URL>`.
- `src/legal/content.ts` > `LEGAL_INFO`: fill in the business details and set the three URLs to `https://<your Render URL>/legal/privacy.html`, `/legal/terms.html` and `/legal/delete-account.html`. Run `npm run legal:site` and push.
- Paste those URLs into the Google Play Console (see `PLAY_STORE.md`).

## Security notes

- All settings are validated at startup; production stops if a required key is missing or `BETTER_AUTH_SECRET` is weak.
- Passwords are hashed by Better Auth (scrypt) and never logged. Email codes are never logged in production.
- Rate limits: Better Auth limits sign-in, sign-up, codes, password changes and account deletion in the database; checkout and payment endpoints have their own limits.
- Cross-site protection: the dashboard is served from the API's own origin with `SameSite=Lax` cookies, a strict Content Security Policy, and an origin check on every state-changing request.
- Payment safety: Paynow messages must pass SHA-512 hash verification and match the order amount; the server only polls `paynow.co.zw` URLs.
- Uploads: 5 MB limit, file signature checks, re-encoded by Cloudinary.
- Node 20 reached end of life in April 2026 and no longer gets security fixes. Everything here runs on it, but plan to move to Node 22 LTS when you can (change `NODE_VERSION` in `render.yaml` and `engines` in `package.json`).
