// Single source of truth for LoveNest's legal documents. Rendered in-app by
// LegalScreen and exported to public web pages by `npm run legal:site`
// (Google Play requires a public Privacy Policy URL and account-deletion URL).
//
// Keep this file free of runtime imports; the site builder loads it standalone.
//
// IMPORTANT: Have these reviewed by a lawyer before launch, and fill in every
// `[[…]]` placeholder in LEGAL_INFO. Bump LEGAL_VERSION whenever the text
// changes materially so users can be asked to accept the new version.

export const LEGAL_VERSION = '2026-10-08';
export const EFFECTIVE_DATE = '8 October 2026';

export const LEGAL_INFO = {
  appName: 'LoveNest Gifts',
  businessName: '[[Registered business name]]',
  address: '[[Physical business address, Harare, Zimbabwe]]',
  email: '[[support email address]]',
  whatsapp: '+263 78 582 3025',
  country: 'Zimbabwe',
  /** Public URLs where the web versions are hosted (needed for the Play Console). */
  // Served by the API at /legal/ once deployed, e.g. https://lovenest-api.onrender.com/legal/privacy.html
  privacyUrl: '[[https://your-api-url/legal/privacy.html]]',
  termsUrl: '[[https://your-api-url/legal/terms.html]]',
  deleteAccountUrl: '[[https://your-api-url/legal/delete-account.html]]',
};

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDocId = 'privacy' | 'terms' | 'refunds';
export type LegalDocument = { id: LegalDocId; title: string; summary: string; sections: LegalSection[] };

const I = LEGAL_INFO;
const CONTACT = `${I.businessName}, ${I.address}. Email: ${I.email}. WhatsApp: ${I.whatsapp}.`;

export const hasPlaceholders = () => Object.values(LEGAL_INFO).some((v) => v.includes('[['));

const privacy: LegalDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  summary: `How ${I.appName} collects, uses and protects your personal information.`,
  sections: [
    {
      heading: '1. Who we are',
      paragraphs: [
        `${I.appName} ("LoveNest", "we", "us") is operated by ${I.businessName}, based in ${I.country}. We are the controller of the personal information described in this policy. This policy applies to the LoveNest mobile app and related services.`,
        'We process personal information in line with the Cyber and Data Protection Act [Chapter 12:07] of Zimbabwe and other applicable data protection laws.',
      ],
    },
    {
      heading: '2. Information we collect',
      paragraphs: ['We only collect what we need to run the service:'],
      bullets: [
        'Account information: your name, email address and password. Passwords are stored by our servers in hashed form and are never visible to our staff.',
        'Google Sign-In: if you choose "Continue with Google", we receive your name, email address and Google account identifier from Google. We do not receive your Google password.',
        'Order and delivery information: the items you order, recipient name, recipient phone number, delivery address, delivery instructions and any gift message you write.',
        'Payment information: the payment method you choose (for example mobile money or cash on delivery) and transaction references. Mobile money payments are processed by the payment provider; we never see or store your mobile money PIN.',
        'Support communications: messages you send us, including through WhatsApp. Tapping a WhatsApp button opens WhatsApp with a suggested message; nothing is sent until you choose to send it, and your use of WhatsApp is governed by WhatsApp’s own privacy policy.',
        'Technical and security information: when you use our services our servers may log your IP address, device type, operating system, app version, timestamps and failed sign-in attempts, to keep the service secure and prevent fraud.',
        'Information stored on your device: settings such as light/dark mode, your signed-in session, a copy of your orders and their delivery progress, in-app notifications (such as order updates) and limits on repeated sign-in attempts are stored locally on your device. Signing out keeps these settings; deleting the app removes them.',
      ],
    },
    {
      heading: '3. How we use your information',
      bullets: [
        'To create and manage your account and sign you in.',
        'To process, deliver and support your orders, including contacting you or the recipient about a delivery.',
        'To send service messages such as order confirmations, delivery progress updates (for example "Out for delivery"), short notes from our team about your order, and password reset codes.',
        'To protect accounts and the service, including limiting repeated sign-in attempts and detecting fraud or abuse.',
        'To meet our legal, tax and accounting obligations.',
        'To improve the app, using aggregated information that does not identify you.',
        'To send marketing messages, but only where you have agreed to receive them. You can opt out at any time.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: '4. Legal grounds for processing',
      paragraphs: [
        'We process your information because it is necessary to provide the service you asked for (our contract with you), to comply with the law, for our legitimate interests in running a secure and reliable service, or because you have given consent (which you may withdraw at any time).',
      ],
    },
    {
      heading: '5. Information about gift recipients',
      paragraphs: [
        "When you send a gift you give us another person's name, phone number and address. Please only do so when you are entitled to share those details for the purpose of the delivery. We use recipient details only to deliver the order and contact the recipient about it.",
      ],
    },
    {
      heading: '6. Who we share information with',
      paragraphs: [
        'Within LoveNest, only authorised administrators can access account, order and product information, through a password-protected admin dashboard, and only to run the service: for example to help with an order, answer a support request, create an account on your behalf, or suspend or delete an account. Administrator access is limited to what is needed for these tasks.',
        'We share personal information outside LoveNest only where needed, and require these parties to protect it:',
      ],
      bullets: [
        'Delivery partners and couriers, who receive the recipient details needed to deliver your order.',
        'Paynow (Zimbabwe), our payment gateway, and your mobile money operator (EcoCash or OneMoney), which receive your order reference, amount, payment phone number and email to process the payment.',
        'Google, if you use Google Sign-In.',
        'Service providers that run LoveNest on our behalf and may only use the data for that purpose: Render (application hosting), Turso (database), Resend (sending emails such as password reset codes) and Cloudinary (product photos; no customer data).',
        'Authorities, courts or regulators where the law requires it, or to protect the rights, property or safety of LoveNest, our customers or others.',
        'A buyer or successor if our business is sold or restructured, subject to this policy.',
      ],
    },
    {
      heading: '7. International transfers',
      paragraphs: [
        `Our hosting, database and email providers (Render, Turso and Resend) store or process information outside ${I.country}, in the European Union and the United States. Where this happens we take the steps required by law, including contracts with these providers, to ensure your information receives an adequate level of protection.`,
      ],
    },
    {
      heading: '8. How long we keep information',
      bullets: [
        'Account information is kept while your account is active.',
        'When you delete your account, we delete or anonymise your personal information within 30 days.',
        'Order, payment and invoice records may be kept for longer where tax, accounting or other laws require it, after which they are deleted.',
        'Security logs are kept for a limited period, normally no more than 12 months.',
      ],
    },
    {
      heading: '9. How we protect your information',
      paragraphs: [
        'We use encryption in transit (HTTPS), hashed passwords, access controls and limits on repeated sign-in and verification attempts. No system is perfectly secure, so please use a strong, unique password and keep your device secure. We will notify you and the regulator of a data breach where the law requires it.',
      ],
    },
    {
      heading: '10. Your rights',
      paragraphs: ['Subject to the law, you have the right to:'],
      bullets: [
        'Access the personal information we hold about you.',
        'Correct information that is inaccurate or incomplete.',
        'Ask us to delete your information.',
        'Object to or restrict certain processing, including direct marketing.',
        'Withdraw consent where we rely on it.',
        'Lodge a complaint with the Data Protection Authority (POTRAZ) in Zimbabwe.',
      ],
    },
    {
      heading: '11. Deleting your account',
      paragraphs: [
        'You can delete your account at any time in the app under Profile → Delete Account. You can also request deletion on the web at ' +
          I.deleteAccountUrl +
          ` or by contacting us at ${I.email}. Deleting your account removes your profile, sign-in details and saved delivery details. Records we must keep by law are retained only as long as required (see section 8).`,
      ],
    },
    {
      heading: '12. Children',
      paragraphs: [
        'LoveNest is intended for people aged 18 and over. We do not knowingly collect personal information from children under 13. If you believe a child has given us personal information, contact us and we will delete it.',
      ],
    },
    {
      heading: '13. Changes to this policy',
      paragraphs: [
        'We may update this policy from time to time. We will show the new effective date at the top and, for significant changes, notify you in the app before they take effect.',
      ],
    },
    { heading: '14. Contact us', paragraphs: [CONTACT] },
  ],
};

const terms: LegalDocument = {
  id: 'terms',
  title: 'Terms of Use',
  summary: `The agreement between you and ${I.businessName} for using ${I.appName}.`,
  sections: [
    {
      heading: '1. Agreeing to these terms',
      paragraphs: [
        `These Terms of Use ("Terms") govern your use of the ${I.appName} app and services provided by ${I.businessName} ("LoveNest", "we", "us"). By creating an account or placing an order you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the app.`,
      ],
    },
    {
      heading: '2. Eligibility',
      paragraphs: ['You must be at least 18 years old and able to enter into a binding contract to create an account or place orders.'],
    },
    {
      heading: '3. Your account',
      bullets: [
        'Provide accurate, current information and keep it up to date.',
        'Keep your password confidential. You are responsible for activity on your account. You can change your password at any time in the app under Profile, Change Password.',
        'If we create an account for you, we will give you a temporary password, and you must choose a new one the first time you sign in.',
        'Tell us immediately if you suspect unauthorised use of your account.',
        'We may limit repeated sign-in, verification or ordering attempts to protect accounts and the service.',
      ],
    },
    {
      heading: '4. Products, prices and orders',
      bullets: [
        'Prices are shown in US dollars (US$) and include the delivery fee shown at checkout.',
        'Product photos are illustrative. Flowers, cakes and similar items may vary slightly in colour, size or arrangement; we may substitute an item of similar style and equal or greater value if something is unavailable.',
        'Before paying, you review your items, delivery details and total and confirm they are correct. Completing the payment step (or choosing cash on delivery) is an offer to buy, and a contract is formed when we confirm your order.',
        'We may refuse or cancel an order, for example if an item is unavailable, a price was shown in error, payment fails, or we suspect fraud. If we cancel after you have paid, we will refund you in full.',
      ],
    },
    {
      heading: '5. Payment',
      paragraphs: [
        'You can pay by the methods offered at checkout, such as mobile money or cash on delivery. Mobile money payments are also subject to your provider\'s terms. For cash on delivery, payment of the full amount is due when the order is handed over.',
      ],
    },
    {
      heading: '6. Delivery',
      bullets: [
        'We deliver to the areas shown in the app. Delivery dates and times are estimates and may be affected by circumstances outside our control.',
        'You can follow each order in the app under My Orders. We update its progress (confirmed, being prepared, out for delivery, delivered) as it happens and may add a short note, such as who is delivering it. Progress updates are for information and are not a guaranteed delivery time.',
        'If we cancel your order, you will see this in the app. If you already paid, we will refund you as described in our Returns & Refunds Policy.',
        'You are responsible for giving a correct address and a reachable recipient phone number.',
        'If a delivery fails because the details were wrong or the recipient was unavailable, a redelivery fee may apply. Perishable items cannot be held indefinitely.',
      ],
    },
    {
      heading: '7. Cancellations, returns and refunds',
      paragraphs: ['Cancellations, returns and refunds are handled under our Returns & Refunds Policy, which forms part of these Terms.'],
    },
    {
      heading: '8. Gift messages and your content',
      paragraphs: [
        'You are responsible for gift messages and other content you submit. Do not submit anything unlawful, threatening, harassing, hateful, obscene or that infringes someone else\'s rights. We may decline to include content that breaches these Terms.',
      ],
    },
    {
      heading: '9. Acceptable use',
      paragraphs: ['You agree not to:'],
      bullets: [
        'Use the app for fraud, or to place false or malicious orders.',
        'Try to access other people\'s accounts, or bypass security features or rate limits.',
        'Interfere with, overload, scrape, copy, reverse engineer or resell the service, except where the law allows.',
        'Use the app in breach of any law.',
      ],
    },
    {
      heading: '10. Intellectual property',
      paragraphs: [
        'The LoveNest name, logo, product images and other content we provide are owned by us or our licensors. We grant you a personal, non-transferable, revocable licence to use the app for its intended purpose.',
        'The app’s source code is made available under the Apache License 2.0. That licence covers the code only; it does not give anyone the right to use the LoveNest name, logo or other brand assets, or to present a modified version as the official LoveNest app.',
      ],
    },
    {
      heading: '11. Disclaimers and limitation of liability',
      paragraphs: [
        'We work hard to keep the app available and accurate, but it is provided "as is" and may occasionally be unavailable or contain errors.',
        'To the extent permitted by law, we are not liable for indirect or consequential losses, and our total liability for any order is limited to the amount you paid for that order. Nothing in these Terms limits rights you have under the Consumer Protection Act [Chapter 14:44] or any other law that cannot be excluded.',
      ],
    },
    {
      heading: '12. Suspension and termination',
      paragraphs: [
        'You may stop using the app and delete your account at any time. We may suspend or close accounts that breach these Terms or that we reasonably believe are being used for fraud or abuse. A suspended account cannot sign in or place orders until it is reactivated. If you believe your account was suspended by mistake, contact us.',
      ],
    },
    {
      heading: '13. Governing law',
      paragraphs: [`These Terms are governed by the laws of ${I.country}. Disputes will be handled by the courts of ${I.country}, without affecting any mandatory consumer rights you have.`],
    },
    {
      heading: '14. Changes to these terms',
      paragraphs: [
        'We may update these Terms. We will show the new effective date and, for significant changes, notify you in the app. Continuing to use the app after changes take effect means you accept them.',
      ],
    },
    { heading: '15. Contact us', paragraphs: [CONTACT] },
  ],
};

const refunds: LegalDocument = {
  id: 'refunds',
  title: 'Returns & Refunds Policy',
  summary: 'How cancellations, returns and refunds work for LoveNest orders.',
  sections: [
    {
      heading: '1. Cancelling an order',
      bullets: [
        'You can cancel free of charge before your order is prepared or dispatched. Contact us as soon as possible.',
        'Once an order has been prepared or dispatched it may not be possible to cancel, especially for flowers, cakes and personalised items.',
      ],
    },
    {
      heading: '2. Perishable and personalised items',
      paragraphs: [
        'Flowers, cakes, food and personalised or custom-made items cannot be returned for a change of mind. If they arrive damaged, incorrect or not as described, contact us within 24 hours of delivery with your order number and photos, and we will replace the item or refund you.',
      ],
    },
    {
      heading: '3. Other items',
      paragraphs: [
        'Non-perishable items may be returned within 7 days of delivery if unused and in their original packaging. Faulty, damaged or incorrect items can always be returned and we cover the return cost.',
      ],
    },
    {
      heading: '4. Refunds',
      bullets: [
        'Approved refunds are paid to the original payment method where possible, or by mobile money for cash-on-delivery orders.',
        'We aim to process refunds within 7–14 business days of approval.',
        'Delivery fees are refunded when the order was cancelled before dispatch or the problem was our fault.',
      ],
    },
    {
      heading: '5. Failed deliveries',
      paragraphs: [
        'If we cannot deliver because the address or phone number provided was incorrect, or the recipient was unavailable, we will try to contact you. A redelivery fee may apply, and perishable items may not be refundable.',
      ],
    },
    {
      heading: '6. Your legal rights',
      paragraphs: ['This policy does not affect your rights under the Consumer Protection Act [Chapter 14:44] or other applicable law.'],
    },
    { heading: '7. Contact us', paragraphs: [CONTACT] },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = { privacy, terms, refunds };
