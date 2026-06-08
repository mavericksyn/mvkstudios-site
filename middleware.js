// ── Pre-launch gate ──────────────────────────────────────────────
// Locks every page behind a shared password until launch.
// Password is stored in the Vercel env var SITE_PASSWORD (never in code).
// Runs at the edge on every request, so files cannot be reached unlocked.

import { next } from '@vercel/edge';

export const config = {
  // Gate everything except the brand logo (so the lock screen can show it)
  // and Vercel internals.
  matcher: ['/((?!brand/|_vercel|favicon).*)'],
};

const COOKIE = 'mvk_gate';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Derive an opaque cookie token from the password so the raw
// password is never written to the browser.
async function tokenFor(password) {
  const data = new TextEncoder().encode('mvk-gate::' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD || '';
  const token = await tokenFor(password);
  const url = new URL(request.url);

  // ── Handle unlock submission ──
  if (request.method === 'POST' && url.pathname === '/__unlock') {
    const form = await request.formData();
    const attempt = (form.get('password') || '').toString();
    if (password && attempt === password) {
      const res = new Response(null, { status: 303, headers: { Location: '/' } });
      res.headers.append(
        'Set-Cookie',
        `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`
      );
      return res;
    }
    return lockScreen(true);
  }

  // ── Already unlocked? ──
  const cookie = request.headers.get('cookie') || '';
  const hit = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + '='));
  if (hit && hit.slice(COOKIE.length + 1) === token) {
    return next();
  }

  // ── Locked ──
  return lockScreen(false);
}

function lockScreen(error) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>MVK Studios — Launching Soon</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=Barlow:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--blue:#1E0FC8;--blue2:#2d1ee0;--bg:#06060f;--off:#EBEBEB;--muted:rgba(235,235,235,0.6);--border:rgba(255,255,255,0.1)}
    body{font-family:'Barlow',sans-serif;background:var(--bg);color:var(--off);min-height:100vh;min-height:100svh;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden;position:relative}
    body::before{content:'';position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(30,15,200,0.28) 0%,transparent 68%);top:-25%;right:-15%;pointer-events:none}
    body::after{content:'';position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(30,15,200,0.14) 0%,transparent 70%);bottom:-20%;left:-12%;pointer-events:none}
    .grid{position:absolute;inset:0;background-image:repeating-linear-gradient(-55deg,transparent 0 56px,rgba(255,255,255,0.02) 56px 57px);pointer-events:none}
    .card{position:relative;z-index:2;width:100%;max-width:420px;text-align:center}
    .logo{height:54px;width:auto;margin:0 auto 22px;display:block}
    .eyebrow{font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:var(--muted);margin-bottom:36px}
    h1{font-family:'Barlow Condensed',sans-serif;font-size:2.4rem;font-weight:900;line-height:0.95;text-transform:uppercase;color:#fff;margin-bottom:14px}
    h1 .dim{color:rgba(255,255,255,0.32)}
    p.lead{font-size:0.92rem;font-weight:300;color:var(--muted);line-height:1.65;margin-bottom:32px}
    form{display:flex;flex-direction:column;gap:12px}
    input{font-family:'Barlow',sans-serif;font-size:0.95rem;color:#fff;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:15px 18px;text-align:center;letter-spacing:0.04em;transition:border-color .15s,background .15s}
    input::placeholder{color:rgba(235,235,235,0.4)}
    input:focus{outline:none;border-color:var(--blue2);background:rgba(30,15,200,0.08)}
    button{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.9rem;letter-spacing:0.1em;text-transform:uppercase;color:#fff;background:var(--blue);border:1.5px solid var(--blue);border-radius:8px;padding:15px 18px;cursor:pointer;transition:background .2s,box-shadow .2s;box-shadow:0 0 24px rgba(30,15,200,0.4)}
    button:hover{background:var(--blue2);box-shadow:0 0 36px rgba(30,15,200,0.6)}
    .err{font-size:0.82rem;color:#f87171;min-height:18px;margin-top:2px}
    .foot{margin-top:40px;font-size:0.74rem;color:rgba(235,235,235,0.3);letter-spacing:0.04em}
  </style>
</head>
<body>
  <div class="grid"></div>
  <div class="card">
    <img class="logo" src="/brand/Logo-WT.png" alt="MVK Studios" />
    <div class="eyebrow">Strategy, Systems &amp; AI Operating Teams</div>
    <h1>Launching<br><span class="dim">Soon.</span></h1>
    <p class="lead">This site is in private preview ahead of launch. Enter the access password to continue.</p>
    <form method="POST" action="/__unlock" autocomplete="off">
      <input type="password" name="password" placeholder="Access password" autofocus required />
      <div class="err">${error ? 'Incorrect password. Try again.' : ''}</div>
      <button type="submit">Unlock</button>
    </form>
    <div class="foot">&copy; 2026 MVK Studios</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
