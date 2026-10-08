# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Keep docs and legal text in sync

Every change to the app must also update, in the same piece of work:

1. **README.md**: the Features / Project structure sections if affected, and add a dated entry to the **Changelog**.
2. **src/legal/content.ts**: update the Privacy Policy and/or Terms of Use whenever a change affects what data is collected, stored, shared, how orders/payments/delivery work, or user rights. Then bump `LEGAL_VERSION` and `EFFECTIVE_DATE` and run `npm run legal:site`.
3. **PLAY_STORE.md**: update the Data safety table if data collection changes.

If a change needs no legal update, say so explicitly when reporting the work.
