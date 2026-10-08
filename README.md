<p align="center">
  <img src="assets/logo.png" alt="LoveNest logo" width="96" />
</p>

<h1 align="center">LoveNest Gifts</h1>

<p align="center"><em>Gifts for every moment, delivered with love.</em></p>

LoveNest is a gift-shopping mobile app for Zimbabwe, built with Expo and React Native. Customers browse gifts by occasion, add a personal touch, and have them delivered, paying by mobile money (EcoCash / Telecash) or cash on delivery.

> **Status:** frontend complete, running on a **mock backend**. Accounts, reset codes and orders are simulated on the device. See [Backend](#backend) before going live.

---

## Features

**Shopping**
- Home dashboard with a search bar, a hero banner and category shortcuts. Search and **Shop Now** open the market.
- Market (Categories tab) with an **All** view by default, category filters, and search across product names, descriptions and categories.
- Product details, cart, and a 4-step checkout: **Cart → Delivery → Confirm → Payment**. The order is reviewed and confirmed *before* payment.
- Order history, and an order success screen.

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
- **Overview**: customer, new sign-up and product counts, plus recent sign-ups and products.
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

### Admin dashboard

The dashboard is a plain static site, so no build step is needed:

```bash
cd admin
python -m http.server 8080      # then open http://localhost:8080
```

In demo mode, sign in with **admin@lovenest.app** and **Admin1234**. Demo data is stored in your browser's local storage. Don't deploy it publicly until it's connected to the backend: demo mode shows those sign-in details on the login screen.

### Trying the demo flows

- **Sign up**: create any account. Accounts live in memory, so they reset when the app reloads, but your session persists.
- **Password reset**: Forgot password → enter your email → the 6-digit **demo code appears in a pop-up** (development builds only).
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
  theme.ts                  Colours, spacing, radii, fonts
scripts/build-legal-site.mjs  Builds legal-site/*.html from the legal content
admin/                      Admin dashboard (static site)
  index.html                Sign in, app shell, pages, sheets and alerts
  css/admin.css             Apple HIG styling, light and dark palettes
  js/api.js                 Data layer (mock today; swap in fetch() calls to the backend)
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

### Today

There is no server yet. All auth logic sits behind a mock `api` object in `src/store/auth.ts`; replace it with real HTTP calls and keep the contract: **resolve on success, throw `AuthError` on failure**. The screens need no changes.

The client-side checks are for user experience only. Before launch, the backend **must**:
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
