// Builds static web pages for the legal documents from src/legal/content.ts,
// so the in-app text and the public URLs Google Play requires never drift apart.
//
//   npm run legal:site   →   writes ./legal-site/*.html  (host on GitHub Pages, Netlify, etc.)

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'legal-site');

// Transpile the TS content module on the fly (Node 20 can't import .ts directly).
const source = readFileSync(join(root, 'src/legal/content.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
mkdirSync(outDir, { recursive: true });
const tmp = join(outDir, '.content.mjs');
writeFileSync(tmp, outputText);
const { LEGAL_DOCUMENTS, LEGAL_INFO, EFFECTIVE_DATE, hasPlaceholders } = await import(pathToFileURL(tmp).href);
rmSync(tmp);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(LEGAL_INFO.appName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#FFF7F7; --surface:#FFFFFF; --alt:#FBE6E9; --text:#1A1416; --muted:#6E6568; --border:#F0DCDE; --primary:#E2233F; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0F0A0C; --surface:#1C1417; --alt:#2A171B; --text:#FFFFFF; --muted:#BBA9AC; --border:#33272A; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.65 Poppins, system-ui, sans-serif; padding:0 16px; }
  main { max-width:760px; margin:0 auto; padding:40px 0 64px; }
  header { display:flex; align-items:baseline; gap:10px; margin-bottom:28px; }
  .brand { font-weight:700; font-size:22px; } .brand span { color:var(--primary); }
  .script { font-family:Pacifico, cursive; color:var(--primary); }
  nav { display:flex; flex-wrap:wrap; gap:8px 16px; margin-bottom:28px; font-size:14px; }
  a { color:var(--primary); font-weight:600; text-decoration:none; } a:hover { text-decoration:underline; }
  h1 { font-size:30px; margin:0 0 4px; }
  .meta { color:var(--muted); font-size:13px; margin-bottom:24px; }
  .intro { background:var(--alt); border:1px solid var(--border); border-radius:14px; padding:14px 18px; margin-bottom:28px; }
  h2 { font-size:18px; margin:28px 0 6px; }
  p, li { color:var(--muted); } ul { padding-left:20px; } li { margin-bottom:6px; } li::marker { color:var(--primary); }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px; margin:16px 0; }
  footer { margin-top:48px; color:var(--muted); font-size:13px; border-top:1px solid var(--border); padding-top:16px; }
</style>
</head>
<body><main>
<header><div class="brand">Love<span>Nest</span></div><div class="script">Gifts</div></header>
<nav><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a><a href="refunds.html">Returns &amp; Refunds</a><a href="delete-account.html">Delete Account</a></nav>
${body}
<footer>© ${new Date().getFullYear()} ${esc(LEGAL_INFO.businessName)} · ${esc(LEGAL_INFO.email)} · WhatsApp ${esc(LEGAL_INFO.whatsapp)}</footer>
</main></body></html>
`;

for (const doc of Object.values(LEGAL_DOCUMENTS)) {
  const sections = doc.sections
    .map(
      (s) =>
        `<h2>${esc(s.heading)}</h2>` +
        (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        (s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''),
    )
    .join('\n');
  writeFileSync(
    join(outDir, `${doc.id}.html`),
    page(doc.title, `<h1>${esc(doc.title)}</h1><div class="meta">Effective ${esc(EFFECTIVE_DATE)}</div><div class="intro">${esc(doc.summary)}</div>${sections}`),
  );
}

// Google Play requires a web page where users can request account + data deletion.
writeFileSync(
  join(outDir, 'delete-account.html'),
  page(
    'Delete your account',
    `<h1>Delete your LoveNest account</h1>
<div class="meta">${esc(LEGAL_INFO.appName)} by ${esc(LEGAL_INFO.businessName)}</div>
<div class="card"><h2>In the app (fastest)</h2><ol><li>Open LoveNest and sign in.</li><li>Go to <b>Profile → Delete Account</b>.</li><li>Confirm with your password and tap <b>Delete My Account</b>.</li></ol></div>
<div class="card"><h2>Without the app</h2><p>Email <a href="mailto:${esc(LEGAL_INFO.email)}">${esc(LEGAL_INFO.email)}</a> from the address linked to your account with the subject "Delete my account". We will verify the request and delete your account within 30 days.</p></div>
<h2>What is deleted</h2><ul><li>Your profile, name and email address</li><li>Your sign-in details</li><li>Saved delivery details</li></ul>
<h2>What we keep, and for how long</h2><p>Order, payment and invoice records may be kept for as long as tax and accounting laws require, then deleted. Security logs are kept for no more than 12 months. See our <a href="privacy.html">Privacy Policy</a>.</p>`,
  ),
);

writeFileSync(
  join(outDir, 'index.html'),
  page('Legal', `<h1>Legal</h1><p>Policies for the ${esc(LEGAL_INFO.appName)} app.</p><ul>${Object.values(LEGAL_DOCUMENTS).map((d) => `<li><a href="${d.id}.html">${esc(d.title)}</a></li>`).join('')}<li><a href="delete-account.html">Delete your account</a></li></ul>`),
);

console.log(`Legal site written to ${outDir}`);
if (hasPlaceholders()) console.warn('Warning: LEGAL_INFO in src/legal/content.ts still has [[placeholders]]. Fill them in before publishing.');
