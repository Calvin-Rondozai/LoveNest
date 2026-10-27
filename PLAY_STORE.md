# Google Play launch checklist

What's needed to publish LoveNest, beyond the code. Items marked **[x]** are already done in the app.

## Legal & policy

- [ ] Fill in every `[[placeholder]]` in `LEGAL_INFO` (`src/legal/content.ts`): business name, address, email, URLs.
- [ ] Have a lawyer review the Privacy Policy, Terms of Use and Returns & Refunds Policy.
- [ ] Run `npm run legal:site` and host `legal-site/` publicly (GitHub Pages / Netlify are free). Put the URLs back into `LEGAL_INFO`.
- [ ] Play Console → App content → **Privacy policy**: paste the hosted `privacy.html` URL.
- [ ] Play Console → App content → **Data deletion**: paste the hosted `delete-account.html` URL.
- [x] Privacy Policy, Terms, Returns & Refunds viewable in-app (Profile → Legal & Account, and from Login / Sign-up).
- [x] Sign-up requires accepting the Terms + Privacy Policy and confirming age 18+; the accepted version is recorded.
- [x] In-app account deletion (Profile → Delete Account), required for any app that lets users create accounts.

## Data safety form (Play Console → App content → Data safety)

Answer based on what the app collects once the backend is live:

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | Yes (delivery partners) | Account management, App functionality | No |
| Email address | Yes | No | Account management | No |
| Other user-generated content (security question and hashed answer) | Yes | No | Account management | No |
| Phone number (account) | Yes | No | Account management, App functionality | No |
| Phone number (recipient) | Yes | Yes (delivery partners) | App functionality | No |
| Address (delivery) | Yes | Yes (delivery partners) | App functionality | No |
| Phone number (mobile money payer) | Yes | No | App functionality (payments) | No (required for EcoCash) |
| Purchase history | Yes | No | App functionality | No |
| Other user-generated content (gift messages, instructions) | Yes | Yes (delivery partners) | App functionality | Yes |
| Payment info | No* | n/a | n/a | n/a |

\* Mobile money is processed by Paynow and the operator; LoveNest never sees PINs. Update this if you add card payments.

Google Play does not count transfers to service providers acting on your behalf (Paynow, Render, Turso, Cloudinary) as "sharing", so the Shared column only covers delivery partners.

- Data is encrypted in transit: **Yes** (make sure the backend is HTTPS-only).
- Users can request data deletion: **Yes** (in-app + web URL).
- If you add analytics/crash reporting (e.g. Sentry, Firebase), add "App info and performance" and update the Privacy Policy.

## Other Play Console requirements

- [ ] **Package name**: set `android.package` in `app.json` (e.g. `com.yourcompany.lovenest`). It can never change after the first upload.
- [ ] **Content rating** questionnaire.
- [ ] **Target audience**: 18+ (matches the Terms). Avoids Families policy requirements.
- [ ] **Store listing**: 512×512 icon (`assets/play-store-icon-512.png`, done), 1024×500 feature graphic, at least 2 phone screenshots, short + full description.
- [ ] Google Play **developer account** verification (identity, and D-U-N-S number if registering as an organisation).
- [ ] New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before production access.
- [ ] Build an AAB with EAS: `npx eas build -p android --profile production`.

## Backend safeguards (done in `server/`)

The app's own checks are for user experience; the server enforces all of these:

- Re-validate every field (same rules as `src/utils/validation.ts`).
- Rate-limit login, sign-up, and password-recovery requests per account **and** per IP; return `429` with `Retry-After` (the app already maps this to its lockout UI via `AuthError('rate_limited')`).
- Hash passwords (Better Auth) and hash security answers (HMAC-SHA256). Password reset uses the security question from sign-up, not an emailed code.
- Use idempotency keys on order creation so retries never double-charge.
- Actually delete account data on `DELETE /account` within the 30 days promised in the Privacy Policy.
