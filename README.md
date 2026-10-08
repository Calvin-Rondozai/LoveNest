<p align="center">
  <img src="assets/logo.png" alt="LoveNest logo" width="96" />
</p>

<h1 align="center">LoveNest Gifts</h1>

<p align="center"><em>Gifts for every moment, delivered with love.</em></p>

LoveNest is a gift-shopping mobile app for Zimbabwe, built with Expo and React Native. Customers browse gifts by occasion, add a personal touch, and have them delivered, paying by mobile money (EcoCash / Telecash) or cash on delivery.

> **Status:** production-ready code. The app and admin dashboard run on the real API in [`server/`](server/README.md). To go live, create the service accounts and follow **Going live** in the server README.

---

## Features

**Shopping**
- Home dashboard with a search bar, a hero banner and category shortcuts. Search and **Shop Now** open the market.
- Market (Categories tab) with an **All** view by default, category filters, and search across product names, descriptions and categories.
- Product details, cart, and a 4-step checkout: **Cart → Delivery → Confirm → Payment**. The order is reviewed and confirmed *before* payment.
- **Order tracking**: My Orders shows each order's status and a progress bar; Order Details shows a step-by-step timeline (Order placed, Confirmed, Being prepared, Out for delivery, Delivered, or Cancelled), notes from the shop, items, delivery details and payment status. Status changes arrive as in-app notifications. Pull down to refresh.

**Accounts**
- Email/password sign-up and login, plus a *Continue with Google* button (placeholder until a dev build is configured).
- Forgot password with a **6-digit code**. The boxes turn green when the code is right and shake red when it's wrong; codes expire after 10 minutes.
- Signing up requires accepting the Terms and Privacy Policy and confirming age 18+. The accepted version is recorded.
- **Change Password** in Profile for email accounts. You confirm your current password, and wrong guesses lead to a lockout.
- In-app **Delete Account**, as Google Play requires.

**Security**
- Shared form validation (`src/utils/validation.ts`) for email, names, passwords (8+ characters, a letter and a number), addresses and phone numbers.
- Client-side rate limiting (`src/utils/rateLimit.ts`) on login, sign-up, reset-code requests, code entry and order placement, with lockouts that double each time and a live countdown. Network failures never count as failed attempts.
- Phone numbers can be typed locally (`0771 234 567`) or internationally (`+263…`) and are always stored in full international form (`+263771234567`).

**Engagement and support**
- 3-page onboarding shown on first launch.
- In-app notification centre (bell on Home) with an unread badge, mark-as-read, and links to orders or the market.
- One-tap WhatsApp chat with the shop, with a pre-filled message.
- Light and dark mode.

**Admin dashboard** (`admin/`)
- Separate web dashboard in HTML, CSS, JavaScript and Bootstrap 5, designed to Apple's Human Interface Guidelines.
- **Overview**: open orders, customers, new sign-ups and products, an "Orders to handle" list (oldest first), recent sign-ups and products.
- **Orders**: search by order number, customer or recipient; filter Active, Delivered, Cancelled or All. Open an order to see the customer, recipient (tap to call), items, payment and full history, then move it to the next step with an optional message to the customer, or cancel it. Orders only move forward one step at a time; delivered and cancelled orders are locked. Cash on delivery is marked paid on delivery, and cancelled paid orders are flagged "Refund due".
- **Products**: search, filter by category, add and edit with photo upload (images are resized and compressed in the browser), hide or show in the app, delete.
- **Users**: search, filter by role, create (with a generated temporary password), edit name, role and status, suspend or reactivate, delete. You can't delete or demote yourself or the last admin.
- Sidebar on wide screens and a floating tab bar on phones; follows light and dark mode; 44pt tap targets; confirmation only for deletes that can't be undone.

**Legal**
- Privacy Policy, Terms of Use and Returns & Refunds Policy in the app (Profile → Legal & Account) and as generated public web pages.

## Tech stack

| | |
|---|---|
| Framework | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| State | Zustand, persisted with AsyncStorage |
| Fonts | Poppins + Pacifico (`@expo-google-fonts`) |
| Icons | `@expo/vector-icons` (Ionicons, MaterialCommunityIcons) |
| Admin dashboard | HTML, CSS, vanilla JavaScript, Bootstrap 5.3 and Bootstrap Icons (bundled in `admin/vendor`) |

## Getting started

```bash
npm install
npm start          # Expo dev server, then press a (Android), i (iOS) or w (web)
```

Requires Node 20+. Read the [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) before changing native or Expo APIs.

### Backend and admin dashboard

Start the API first (see [server/README.md](server/README.md)):

```bash
cd server && npm install && cp .env.example .env   # fill BETTER_AUTH_SECRET and SEED_ADMIN_*
npm run db:migrate && npm run db:seed && npm run dev
```

The admin dashboard is served by the API at **http://localhost:3000/admin**. Sign in with the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` you set.

Then point the app at it: copy `.env.example` to `.env` in the project root and set `EXPO_PUBLIC_API_URL` (Android emulator: `http://10.0.2.2:3000`; phone on the same Wi-Fi: `http://<your PC IP>:3000`).

### Trying it in development

- **Password reset**: Forgot password, enter your email, and the 6-digit code prints in the server terminal (until Resend is configured).
- **Mobile money**: without Paynow keys the server simulates Paynow. Pay with `0771111111` to succeed, `0773333333` to cancel or `0774444444` for insufficient balance.
- **Google sign-in** needs a development build (`npx expo run:android`), not Expo Go.
- **Onboarding again**: clear the app's storage, or reinstall.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on a platform |
| `npm run legal:site` | Generate the public legal pages into `legal-site/` from `src/legal/content.ts` |
| `npx tsc --noEmit` | Type-check the project |

## Project structure

```
App.tsx                     Fonts, splash screen and storage loading, theme provider
src/
  navigation/               Root stack (onboarding → login screens → app) and bottom tabs
  screens/                  Home, Categories (market), Cart, checkout, Orders, Profile, Notifications, Onboarding
    auth/                   Login, Sign up, Forgot password, Verify code, Reset password
    legal/                  Legal document viewer, Delete account
  components/               Shared UI: Button, FormField, OtpInput, SearchBar, AuthLayout…
  store/                    Zustand stores: auth, cart, checkout, orders, notifications, onboarding, toast
  utils/                    validation, rateLimit, phone, whatsapp
  legal/content.ts          Single source of truth for the Privacy Policy, Terms and Refund Policy
  data/catalog.ts           Categories and products (static for now)
  data/orderStatus.ts       Order steps shared with admin/js/orderStatus.js and the server
  theme.ts                  Colours, spacing, radii, fonts
scripts/build-legal-site.mjs  Builds legal-site/*.html from the legal content
server/                     Backend API (Hono, Better Auth, Drizzle, Turso); see server/README.md
admin/                      Admin dashboard (static site)
  index.html                Sign in, app shell, pages, sheets and alerts
  css/admin.css             Apple HIG styling, light and dark palettes
  js/api.js                 Data layer: calls the LoveNest API (same origin)
  js/orderStatus.js         Order steps, mirrors src/data/orderStatus.ts
  js/app.js                 UI logic, validation, routing
  vendor/                   Bootstrap 5.3.3 and Bootstrap Icons 1.11.3 (MIT)
assets/                     App icon, splash, adaptive icons, logo (brand assets, see NOTICE)
PLAY_STORE.md               Google Play launch checklist and Data safety answers
```

## Brand and design

| Token | Light | Dark |
|---|---|---|
| Primary | `#E2233F` | `#E2233F` |
| Background | `#FFF7F7` | `#0F0A0C` |
| Surface | `#FFFFFF` | `#1C1417` |
| Success (OTP, checks) | `#22B573` | `#22B573` |

Typography: **Poppins** for UI and **Pacifico** for script accents. The app icon, splash screen and Android adaptive/monochrome icons are all generated from `assets/logo.png`.

## Backend

### Chosen stack (all free, no credit card required)

| Piece | Service |
|---|---|
| Database (users, products, orders) | **Turso** (5 GB free), accessed through Drizzle so it can move to Postgres later |
| Product photos | **Cloudinary** (25 free credits a month, automatic resizing for mobile) |
| Server (login, payments, admin API) | **Render** free web service, kept awake by an **UptimeRobot** ping |
| Login | **Better Auth** on that server: email and password, Google sign-in (native, via ID token), 6-digit reset codes |
| Payments | **Paynow** (EcoCash, OneMoney, InnBucks, cards). The integration key stays on the server; orders are only marked paid after the server confirms with Paynow |
| Emails | **Resend** (3,000 a month, 100 a day) |
| Google sign-in setup | Google Cloud Console OAuth client IDs (Web + Android); free, no billing |

Not chosen: Supabase (free projects pause after a week of inactivity), Vercel (free plan bans commercial use), Neon Auth (no official Expo support), and Fly.io, Railway and Koyeb (need a card). When the shop is earning, Render's paid plan (about $7 a month) removes the sleep issue.

### Status

All six stages are built: accounts, products, orders and payments run on the API in [`server/`](server/README.md), and both the app and the admin dashboard use it. The server README has the step-by-step **Going live** guide (Turso, Resend, Cloudinary, Paynow, Google, Render, UptimeRobot). Deployment is described in `render.yaml`.

The client-side checks are for user experience only. Before launch, the backend **must**:
- own the order lifecycle: accept status changes from admins only, allow just "next step" or "cancel", and record each change with a timestamp and optional note;
- let the app fetch the signed-in customer's orders (`GET /orders`) so admin updates appear in My Orders, and later send push notifications for each change;
- re-validate every field and enforce its own rate limits, returning `429` + `Retry-After` (already mapped to the app's lockout UI);
- hash passwords, expire reset codes after 10 minutes, and invalidate them after 5 wrong attempts;
- use idempotency keys when creating orders and payments;
- actually delete account data within the 30 days promised in the Privacy Policy.

Google Sign-In needs a development build and a Google Cloud OAuth client: see [Expo's guide](https://docs.expo.dev/guides/google-authentication/).

See [`PLAY_STORE.md`](PLAY_STORE.md) for the full launch checklist.

## Legal documents

All legal text lives in [`src/legal/content.ts`](src/legal/content.ts) and is shown in the app and on the generated web pages.

1. Fill in the `[[placeholders]]` in `LEGAL_INFO` (business name, address, email, URLs).
2. When the app's behaviour changes what data is collected or how orders work, **update the policies and bump `LEGAL_VERSION` and `EFFECTIVE_DATE`**.
3. Run `npm run legal:site` and re-publish `legal-site/`.
4. Have a lawyer review the text before launch.

## Licence

The source code is licensed under the [Apache License 2.0](LICENSE).

The **LoveNest name, logo and brand images are not covered** by that licence and remain all rights reserved. See [`NOTICE`](NOTICE). Forks must use their own branding.

## Changelog

### 2026-10-08 (production backend)
- Full API: admin users, products with Cloudinary photo upload, server-priced checkout with stock reservation and idempotency keys, Paynow EcoCash/OneMoney with hash-verified results and amount checks, order status changes, customer cancellation, account deletion that keeps order records for accounting.
- The API serves the admin dashboard at `/admin` (same origin, strict CSP) and the legal pages at `/legal`.
- Admin dashboard now uses the real API: real sign-in, forced password change for temporary passwords, photo uploads, live users and orders. Demo data removed.
- Mobile app now uses the real API through the Better Auth Expo client (session in SecureStore): sign-up, sign-in, Google sign-in (development build), reset codes by email, change password, delete account, live catalog with offline cache, checkout with EcoCash, OneMoney or cash, a payment waiting screen, order history and notifications for status and payment changes. Signing out wipes personal data from the device.
- Production safety: the server refuses to start without email, photo and payment keys; development uses a terminal email log, local photo storage and a Paynow simulator.
- Deployment: `render.yaml` (Node 20, free plan, Frankfurt), migrations and first-admin seeding on start.
- 37 server tests; dashboard tested end to end in a browser against the real API.
- Privacy Policy now names Paynow, Render, Turso, Resend, Cloudinary and Google, what each receives, and that data is stored in the EU and US.

### 2026-10-08 (backend stage 1)
- New `server/` backend: Hono 4, Better Auth 1.7 (email and password, 6-digit email codes, admin roles, Expo), Drizzle ORM with libSQL (local SQLite now, Turso in production).
- Database schema for users, sessions, rate limits, categories, products, orders, order items and order events. Money stored in cents.
- Migrations run automatically on start; idempotent seed creates the catalog and the first admin.
- Security: validated configuration, security headers, strict CORS for the admin dashboard, body size limits, database-backed rate limits on sign-in, sign-up, reset codes and password changes.
- 10 automated tests (health, CORS, seeding, sign-up, sign-in, rate limiting, password reset with a 6-digit code).
- App `tsconfig.json` now excludes `server/`, `admin/` and generated folders.
- No legal changes needed yet: nothing is deployed and no new service receives customer data. The Privacy Policy will name Turso, Render, Resend, Cloudinary and Paynow when they go live.

### 2026-10-08 (orders)
- Admin dashboard **Orders** page: list, search and filter orders, open an order, advance it to the next step with a message to the customer, or cancel it (with confirmation and a refund reminder for paid orders). Overview shows open orders and an "Orders to handle" list.
- App: orders are now saved on the device with full details and history. New **Order Details** screen with a progress timeline, and progress bars on My Orders. Status changes create in-app notifications. Development builds include a "simulate next admin update" button until the backend connects the two.
- Order steps are defined once per codebase (`src/data/orderStatus.ts`, `admin/js/orderStatus.js`) with matching keys.
- Privacy Policy: order copies and progress stored on the device; delivery progress updates and team notes. Terms: order tracking in the app, and what happens when we cancel an order.

### 2026-10-08 (later)
- Admin dashboard in `admin/`: sign in, overview, product management with photo upload, and user management (create, edit, suspend, delete). Apple HIG design, responsive from phones to desktops, light and dark mode, Bootstrap bundled locally so it works on weak connections.
- **Change Password** screen in the app (Profile, Legal & Account), with lockout after repeated wrong current passwords.
- Removed all em dashes and emojis from the app, docs and generated pages.
- Backend stack finalized (see [Backend](#backend)).
- Privacy Policy: explains administrator access through the admin dashboard. Terms: password changes, accounts created by LoveNest with temporary passwords, and what suspension means.

### 2026-10-08
- Licensed under Apache 2.0 with a NOTICE excluding brand assets; added this README.
- Checkout reordered to **Cart → Delivery → Confirm → Payment**: confirm the order before paying. The Order Summary screen was merged into Confirm.
- Delivery phone number: the `+` is optional; local numbers (`077…`) are accepted and saved as `+263…`.
- Working notification centre with unread badge on the Home bell.
- WhatsApp "Order Now / Enquiries" banner opens a chat directly.
- Home search and **Shop Now** open the market, which has its own search and an empty-results state.
- Delete Account styled in brand red.
- Terms and Privacy Policy updated: open-source licence vs brand assets, confirm-before-pay, data stored on the device, WhatsApp.

### 2026-10-07
- Login, sign-up, forgot password, 6-digit verification code and reset password screens.
- Shared form validation and client-side rate limiting across all forms.
- Privacy Policy, Terms of Use, Returns & Refunds, in-app account deletion and a generated public legal site.
- 3-page onboarding; app icon, splash and adaptive icons generated from the LoveNest logo.
- **All** category as the default market view; tab bar lifted above the system navigation bar; green border on the WhatsApp icon.
