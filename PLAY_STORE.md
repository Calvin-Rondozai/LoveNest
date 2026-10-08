# Google Play launch checklist

What's needed to publish LoveNest, beyond the code. ✅ = done in the app.

## Legal & policy

- [ ] Fill in every `[[placeholder]]` in `LEGAL_INFO` (`src/legal/content.ts`) — business name, address, email, URLs.
- [ ] Have a lawyer review the Privacy Policy, Terms of Use and Returns & Refunds Policy.
- [ ] Run `npm run legal:site` and host `legal-site/` publicly (GitHub Pages / Netlify are free). Put the URLs back into `LEGAL_INFO`.
- [ ] Play Console → App content → **Privacy policy**: paste the hosted `privacy.html` URL.
- [ ] Play Console → App content → **Data deletion**: paste the hosted `delete-account.html` URL.
- ✅ Privacy Policy, Terms, Returns & Refunds viewable in-app (Profile → Legal & Account, and from Login / Sign-up).
- ✅ Sign-up requires accepting the Terms + Privacy Policy and confirming age 18+; the accepted version is recorded.
- ✅ In-app account deletion (Profile → Delete Account) — required for any app that lets users create accounts.

## Data safety form (Play Console → App content → Data safety)

Answer based on what the app collects once the backend is live:

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | Yes (delivery partners) | Account management, App functionality | No |
| Email address | Yes | No | Account management, Communications | No |
| Phone number (recipient) | Yes | Yes (delivery partners) | App functionality | No |
| Address (delivery) | Yes | Yes (delivery partners) | App functionality | No |
| Purchase history | Yes | No | App functionality | No |
| Other user-generated content (gift messages, instructions) | Yes | Yes (delivery partners) | App functionality | Yes |
| Payment info | No* | — | — | — |

\* Mobile money is processed by the provider; LoveNest never sees PINs. Update this if you add card payments.

- Data is encrypted in transit: **Yes** (make sure the backend is HTTPS-only).
- Users can request data deletion: **Yes** (in-app + web URL).
- If you add analytics/crash reporting (e.g. Sentry, Firebase), add "App info and performance" and update the Privacy Policy.

## Other Play Console requirements

- [ ] **Package name** — set `android.package` in `app.json` (e.g. `com.yourcompany.lovenest`). It can never change after the first upload.
- [ ] **Content rating** questionnaire.
- [ ] **Target audience**: 18+ (matches the Terms). Avoids Families policy requirements.
- [ ] **Store listing**: 512×512 icon (`assets/play-store-icon-512.png` ✅), 1024×500 feature graphic, at least 2 phone screenshots, short + full description.
- [ ] Google Play **developer account** verification (identity, and D-U-N-S number if registering as an organisation).
- [ ] New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before production access.
- [ ] Build an AAB with EAS: `npx eas build -p android --profile production`.

## Backend must enforce (before launch)

The app's validation and rate limiting are client-side only — they improve UX but can be bypassed. The server must:

- Re-validate every field (same rules as `src/utils/validation.ts`).
- Rate-limit login, sign-up, password-reset requests and code verification per account **and** per IP; return `429` with `Retry-After` (the app already maps this to its lockout UI via `AuthError('rate_limited')`).
- Hash passwords (bcrypt/argon2); expire reset codes (10 min) and invalidate after 5 wrong attempts.
- Return the same response for password-reset requests whether or not the email exists.
- Use idempotency keys on order creation so retries never double-charge.
- Actually delete account data on `DELETE /account` within the 30 days promised in the Privacy Policy.
