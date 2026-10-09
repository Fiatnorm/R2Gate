const SUCCESS_MESSAGE = "R2Gate is running successfully.";
const GITHUB_URL = "https://github.com/Fiatnorm/R2Gate";
const LICENSE_TEXT = `MIT License

Copyright (c) 2026 Fiatnorm

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const FILES_PATH = "/_files";
const FILES_PER_PAGE = 200;
const MAX_QUERY_VALUE_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 128;
const TEXT_ENCODER = new TextEncoder();
// Optional Cloudflare Plaintext variable: set DISPLAY_TIME_ZONE to another
// IANA time zone (for example, "Europe/London") to change uploaded-time display.
const DEFAULT_DISPLAY_TIME_ZONE = "Asia/Singapore";
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-max-age": "86400",
};
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="orange" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff9b20"/>
      <stop offset="1" stop-color="#ff6b00"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke="url(#orange)" stroke-width="5" stroke-linejoin="round">
    <ellipse cx="32" cy="14" rx="22" ry="9"/>
    <path d="M10 14v36c0 5 10 9 22 9s22-4 22-9V14"/>
    <path d="M10 26c0 5 10 9 22 9s22-4 22-9"/>
    <path d="M10 38c0 5 10 9 22 9s22-4 22-9"/>
  </g>
  <g fill="#ff8611">
    <circle cx="18" cy="26" r="2.4"/>
    <circle cx="18" cy="38" r="2.4"/>
    <circle cx="18" cy="50" r="2.4"/>
  </g>
</svg>`;

const PAGE_HEADERS = {
  ...CORS_HEADERS,
  "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "content-type": "text/html; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
const FILES_HEADERS = {
  ...PAGE_HEADERS,
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
};
const ERROR_HEADERS = FILES_HEADERS;

const APP_STYLES = `
    :root {
      color-scheme: dark;
      font-family: "Roboto Flex", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      --surface: #121218;
      --surface-container-low: #191920;
      --surface-container: #202029;
      --surface-container-high: #292832;
      --surface-container-highest: #34323f;
      --on-surface: #e7e1ec;
      --on-surface-variant: #c9c3d0;
      --outline: #938f9c;
      --outline-variant: #494652;
      --primary: #cbc2ff;
      --on-primary: #332662;
      --primary-container: #4c3f78;
      --on-primary-container: #e7deff;
      --success: #a9efca;
      --success-container: #143c2c;
      --warning: #f4d06f;
      --warning-container: #4d4112;
      --error: #ffb4ab;
      --error-container: #5f1717;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { min-width: 320px; background: var(--surface); }
    body { min-width: 320px; min-height: 100vh; margin: 0; overflow-x: hidden; background: var(--surface); color: var(--on-surface); font-size: 16px; line-height: 1.5; text-rendering: optimizeLegibility; }
    a { color: inherit; }
    .skip-link { position: fixed; z-index: 30; top: 10px; left: 12px; min-height: 44px; padding: 10px 16px; border-radius: 999px; background: var(--on-surface); color: var(--surface); font-weight: 700; transform: translateY(-160%); transition: transform 160ms ease; }
    .skip-link:focus { transform: translateY(0); }
    .topbar { position: fixed; z-index: 20; inset: 0 0 auto 0; display: flex; align-items: center; justify-content: space-between; height: 72px; padding: 0 24px 0 18px; border-bottom: 1px solid var(--outline-variant); background: var(--surface-container-low); }
    .brand-lockup { display: inline-flex; align-items: center; gap: 12px; min-height: 48px; color: var(--on-surface); text-decoration: none; font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
    .brand-icon { width: 44px; height: 44px; flex: 0 0 auto; }
    .top-meta { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border-radius: 999px; background: var(--surface-container-highest); color: var(--on-surface-variant); font-size: 13px; font-weight: 700; letter-spacing: .02em; }
    .nav-rail { position: fixed; z-index: 15; inset: 72px auto 0 0; width: 88px; padding: 16px 8px; border-right: 1px solid var(--outline-variant); background: var(--surface-container-low); }
    .nav-rail nav { display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
    .nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 64px; min-height: 64px; padding: 7px 4px; border: 0; border-radius: 22px; background: transparent; color: var(--on-surface-variant); font: inherit; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; transition: background-color 160ms ease, color 160ms ease, transform 160ms ease; }
    .nav-item svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .nav-item:hover { background: var(--surface-container-high); color: var(--on-surface); }
    .nav-item:active { transform: scale(.97); }
    .nav-item.active { background: var(--primary-container); color: var(--on-primary-container); }
    .nav-item.disabled { color: #706c78; cursor: not-allowed; }
    .nav-item.disabled:hover { background: transparent; color: #706c78; }
    .nav-item.license { margin-top: auto; }
    .license-dialog { width: min(720px, calc(100% - 48px)); max-height: min(640px, calc(100dvh - 96px)); margin: auto; padding: 0; overflow: hidden; border: 1px solid var(--outline-variant); border-radius: 24px; background: var(--surface-container); color: var(--on-surface); box-shadow: 0 24px 80px rgb(0 0 0 / .58); }
    .license-dialog::backdrop { background: rgb(5 5 10 / .76); backdrop-filter: blur(8px); }
    .license-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 80px; padding: 16px 20px 16px 28px; border-bottom: 1px solid var(--outline-variant); }
    .license-dialog-title { margin: 0; font-size: 28px; font-weight: 620; letter-spacing: -.02em; }
    .license-close { display: grid; place-items: center; flex: 0 0 auto; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 14px; background: var(--surface-container-high); color: var(--on-surface); cursor: pointer; transition: background-color 160ms ease, transform 160ms ease; }
    .license-close:hover { background: var(--surface-container-highest); }
    .license-close:active { transform: scale(.96); }
    .license-close svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; }
    .license-copy { max-height: calc(min(640px, 100dvh - 96px) - 81px); margin: 0; padding: 24px 28px 28px; overflow: auto; color: var(--on-surface-variant); font: 450 13px/1.65 ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .license-copy::first-line { color: var(--success); }
    .page-shell { min-height: 100vh; margin-left: 88px; padding-top: 72px; }
    .page-content { width: min(1120px, calc(100% - 48px)); margin: 0 auto; padding: 48px 0 64px; }
    .files-view, .status-view { width: min(960px, 100%); margin: 0 auto; }
    .page-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(38px, 5vw, 58px); font-weight: 520; letter-spacing: -.035em; line-height: 1.05; text-wrap: balance; }
    .scope-chip { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border-radius: 999px; background: var(--primary-container); color: var(--on-primary-container); font-size: 13px; font-weight: 750; white-space: nowrap; }
    .status-view { display: grid; align-content: center; min-height: calc(100vh - 240px); }
    .status-view .page-header { margin-bottom: 24px; }
    .status-card { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 22px; min-height: 144px; padding: 28px 32px; border: 1px solid #315544; border-radius: 28px; background: var(--success-container); }
    .status-check { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 22px; background: var(--success); color: #063824; }
    .status-check svg { width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .status-message { margin: 0; color: #d6f6e4; font-size: clamp(18px, 1.8vw, 22px); font-weight: 650; letter-spacing: -.015em; }
    .ready-badge { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border: 1px solid #4c7b64; border-radius: 999px; color: var(--success); font-size: 12px; font-weight: 800; letter-spacing: .08em; }
    .status-card.error { border-color: #8e3d39; background: var(--error-container); }
    .status-card.error .status-check { background: var(--error); color: #690005; }
    .status-card.error .status-message { color: #ffdad6; }
    .status-card.error .ready-badge { border-color: #a74f49; color: var(--error); }
    .status-copy { min-width: 0; }
    .status-detail { margin: 7px 0 0; color: #efb8b3; font-size: 14px; }
    .status-issues { margin: 10px 0 0; padding-left: 20px; color: #ffdad6; font-size: 15px; }
    .status-issues li + li { margin-top: 5px; }
    .security-note { display: flex; align-items: center; gap: 12px; min-height: 52px; margin: 0 0 20px; padding: 12px 16px; border-radius: 16px; background: var(--warning-container); color: #ffe38a; font-size: 14px; font-weight: 650; }
    .security-note svg { width: 21px; height: 21px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .file-list { overflow: hidden; border: 1px solid var(--outline-variant); border-radius: 24px; background: var(--surface-container-low); }
    .file-list-head, .file-row { display: grid; grid-template-columns: minmax(0, 1fr) 84px 108px; align-items: center; column-gap: 16px; }
    .file-list-head { min-height: 44px; padding: 0 40px 0 16px; border-bottom: 1px solid var(--outline-variant); background: var(--surface-container-high); color: var(--primary); font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .file-list-head-main, .file-main { display: grid; grid-template-columns: 32px minmax(130px, 1fr) 80px 104px 64px 164px; align-items: center; column-gap: 16px; min-width: 0; }
    .file-list-head-main > span:nth-child(n+3), .file-list-head > span:not(.file-list-head-main) { justify-self: center; text-align: center; }
    .file-list ul { margin: 0; padding: 0; list-style: none; }
    .file-list li + li { border-top: 1px solid var(--outline-variant); }
    .file-row { min-height: 64px; padding: 0 40px 0 16px; color: var(--on-surface); transition: background-color 160ms ease; }
    .file-row:hover { background: var(--surface-container-high); }
    .file-main { align-self: stretch; min-height: 64px; padding: 8px 0; }
    .file-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; background: var(--surface-container-highest); color: var(--on-surface-variant); }
    .file-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .object-cell { min-width: 0; }
    .object-name { display: block; overflow-wrap: anywhere; font-weight: 680; letter-spacing: -.01em; }
    .object-meta { display: none; margin-top: 3px; color: var(--on-surface-variant); font-size: 12px; }
    .access-badge { display: inline-flex; align-items: center; justify-content: center; justify-self: center; min-height: 30px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 750; }
    .access-badge.public { background: #123f2b; color: #94f2bd; }
    .access-badge.protected { background: #54470f; color: #ffe37d; }
    .type-cell { max-width: 100%; overflow: hidden; color: var(--on-surface-variant); font-size: 13px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .size-cell, .date-cell { justify-self: center; color: var(--on-surface-variant); font-size: 13px; font-variant-numeric: tabular-nums; text-align: center; }
    .open-button, .download-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 44px; min-height: 44px; padding: 0 12px; border-radius: 999px; background: var(--primary-container); color: var(--on-primary-container); text-decoration: none; font-size: 12px; font-weight: 760; transition: box-shadow 160ms ease, filter 160ms ease, transform 160ms ease; }
    .open-button svg, .download-button svg { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .open-button:hover, .download-button:hover { box-shadow: 0 8px 18px rgb(203 194 255 / .28); color: #fffaff; filter: brightness(1.18) saturate(1.08); transform: translateY(-1px); }
    .open-button:active, .download-button:active { box-shadow: 0 3px 8px rgb(203 194 255 / .18); color: #f7f0ff; filter: brightness(1.08); transform: translateY(0) scale(.96); }
    .empty { display: grid; place-items: center; min-height: 180px; margin: 0; border: 1px solid var(--outline-variant); border-radius: 24px; background: var(--surface-container-low); color: var(--on-surface-variant); }
    .pagination { display: flex; justify-content: end; margin-top: 20px; }
    .next-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 48px; padding: 0 22px; border-radius: 999px; background: var(--primary); color: var(--on-primary); text-decoration: none; font-size: 14px; font-weight: 760; transition: filter 160ms ease, transform 160ms ease; }
    .next-button:hover { filter: brightness(1.06); }
    .next-button:active { transform: scale(.98); }
    :focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
    @media (max-width: 1100px) {
      .file-list-head { display: none; }
      .file-row { grid-template-columns: minmax(0, 1fr) 44px 44px; gap: 8px; min-height: 82px; padding: 0 14px; }
      .file-main { grid-template-columns: 28px minmax(0, 1fr); gap: 8px; min-height: 82px; padding: 12px 0; }
      .file-icon { width: 28px; height: 28px; align-self: start; }
      .object-meta { display: block; overflow-wrap: anywhere; }
      .type-cell, .size-cell, .date-cell { display: none; }
      .access-badge { grid-column: 2; justify-self: start; min-height: 30px; padding: 0 9px; font-size: 11px; }
      .open-button, .download-button { width: 44px; height: 44px; padding: 0; }
      .open-label, .download-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    }
    @media (max-width: 760px) {
      .topbar { height: 64px; padding: 0 16px; }
      .brand-lockup { gap: 10px; font-size: 20px; }
      .brand-icon { width: 38px; height: 38px; }
      .top-meta { min-height: 36px; padding: 0 12px; font-size: 12px; }
      .nav-rail { inset: auto 0 0 0; width: auto; height: 76px; padding: 5px 8px max(5px, env(safe-area-inset-bottom)); border-top: 1px solid var(--outline-variant); border-right: 0; }
      .nav-rail nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
      .nav-item { width: 100%; min-height: 62px; border-radius: 20px; }
      .nav-item.license { margin-top: 0; }
      .license-dialog { width: calc(100% - 32px); max-height: calc(100dvh - 80px); border-radius: 20px; }
      .license-dialog-header { min-height: 72px; padding: 14px 14px 14px 20px; }
      .license-dialog-title { font-size: 24px; }
      .license-close { width: 44px; height: 44px; border-radius: 14px; }
      .license-copy { max-height: calc(100dvh - 153px); padding: 20px 20px 24px; font-size: 12px; line-height: 1.6; }
      .page-shell { margin-left: 0; padding: 64px 0 76px; }
      .page-content { width: calc(100% - 24px); padding: 28px 0 36px; }
      .page-header { align-items: center; gap: 12px; margin-bottom: 20px; }
      h1 { font-size: clamp(36px, 12vw, 48px); }
      .status-view { min-height: calc(100vh - 204px); }
      .status-card { grid-template-columns: 52px minmax(0, 1fr); gap: 16px; min-height: 132px; padding: 22px; border-radius: 24px; }
      .status-check { width: 52px; height: 52px; border-radius: 18px; }
      .ready-badge { grid-column: 1 / -1; justify-self: start; }
      .security-note { align-items: start; }
      .file-list { border-radius: 20px; }
      .pagination { margin-top: 16px; }
      .next-button { width: 100%; }
    }
    @media (max-width: 420px) {
      .top-meta { display: none; }
      .page-header { align-items: start; flex-direction: column; }
      .scope-chip { min-height: 36px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
    }
`;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function databaseIcon() {
  return `<svg class="brand-icon" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="brand-orange" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#ff9b20"/><stop offset="1" stop-color="#ff6b00"/></linearGradient></defs>
    <g fill="none" stroke="url(#brand-orange)" stroke-width="5" stroke-linejoin="round"><ellipse cx="32" cy="14" rx="22" ry="9"/><path d="M10 14v36c0 5 10 9 22 9s22-4 22-9V14"/><path d="M10 26c0 5 10 9 22 9s22-4 22-9"/><path d="M10 38c0 5 10 9 22 9s22-4 22-9"/></g>
    <g fill="#ff8611"><circle cx="18" cy="26" r="2.4"/><circle cx="18" cy="38" r="2.4"/><circle cx="18" cy="50" r="2.4"/></g>
  </svg>`;
}

function navigation(activePage, filesEnabled = true) {
  const statusItem = activePage === "status"
    ? `<span class="nav-item active" aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><span>Status</span></span>`
    : `<a class="nav-item" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><span>Status</span></a>`;
  const filesItem = !filesEnabled
    ? `<span class="nav-item disabled" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h6l1.7 2H20v8.8A1.7 1.7 0 0 1 18.3 20H5.7A1.7 1.7 0 0 1 4 18.3Z"/><path d="M4 10h16"/></svg><span>Files</span></span>`
    : activePage === "files"
    ? `<span class="nav-item active" aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h6l1.7 2H20v8.8A1.7 1.7 0 0 1 18.3 20H5.7A1.7 1.7 0 0 1 4 18.3Z"/><path d="M4 10h16"/></svg><span>Files</span></span>`
    : `<a class="nav-item" href="${FILES_PATH}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h6l1.7 2H20v8.8A1.7 1.7 0 0 1 18.3 20H5.7A1.7 1.7 0 0 1 4 18.3Z"/><path d="M4 10h16"/></svg><span>Files</span></a>`;
  const licenseItem = `<button class="nav-item license" type="button" popovertarget="license-dialog" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14v8l6-2 6 2v-8"/><circle cx="12" cy="9" r="8"/><circle cx="12" cy="9" r="3.5" fill="currentColor" stroke="none"/></svg><span>License</span></button>`;
  const githubItem = `<a class="nav-item github" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h5v5"/><path d="m20 4-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg><span>GitHub</span></a>`;
  return `<aside class="nav-rail" aria-label="Primary navigation"><nav>${statusItem}${filesItem}${licenseItem}${githubItem}</nav></aside>`;
}

function appPage({ title, activePage, topMeta = "", content, filesEnabled = true }) {
  const licenseDialog = `<section class="license-dialog" id="license-dialog" popover role="dialog" aria-modal="true" aria-labelledby="license-title"><header class="license-dialog-header"><h2 class="license-dialog-title" id="license-title">MIT License</h2><button class="license-close" type="button" popovertarget="license-dialog" popovertargetaction="hide" aria-label="Close MIT License" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><pre class="license-copy">${escapeHtml(LICENSE_TEXT.replace(/^MIT License\n\n/, ""))}</pre></section>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(title)} · R2Gate</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>${APP_STYLES}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="topbar"><a class="brand-lockup" href="/" aria-label="R2Gate status">${databaseIcon()}<span>R2Gate</span></a>${topMeta ? `<span class="top-meta">${escapeHtml(topMeta)}</span>` : ""}</header>
  ${navigation(activePage, filesEnabled)}
  <div class="page-shell"><main class="page-content" id="main-content">${content}</main></div>
  ${licenseDialog}
</body>
</html>`;
}

function timingSafeEqual(left, right, maxLength = MAX_TOKEN_LENGTH) {
  if (
    typeof left !== "string" ||
    typeof right !== "string" ||
    left.length > maxLength ||
    right.length > maxLength
  ) {
    return false;
  }

  const leftBytes = TEXT_ENCODER.encode(left);
  const rightBytes = TEXT_ENCODER.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return difference === 0;
}

async function cursorAccessToken(secret, cursor) {
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(cursor)));
  const binary = String.fromCharCode(...signature);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function requiredKeyFor(accessKeys, objectKey) {
  return Object.hasOwn(accessKeys, objectKey) ? accessKeys[objectKey] : "";
}

function objectHref(objectKey, requiredKey) {
  const params = new URLSearchParams({ object: objectKey });
  if (requiredKey) {
    params.set("key", requiredKey);
  }
  return `${FILES_PATH}?${params}`;
}

function objectDownloadHref(objectKey, requiredKey) {
  const params = new URLSearchParams({ object: objectKey });
  if (requiredKey) {
    params.set("key", requiredKey);
  }
  params.set("download", "1");
  return `${FILES_PATH}?${params}`;
}

function objectFilename(objectKey) {
  return String(objectKey).split("/").pop() || "download";
}

function contentDisposition(objectKey) {
  const filename = objectFilename(objectKey);
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "download";
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function formatSize(size) {
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function createUploadedFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function formatUploaded(uploaded, formatter) {
  const date = uploaded instanceof Date ? uploaded : new Date(uploaded);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const values = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${values.day} ${values.month} ${values.year} ${values.hour}:${values.minute}:${values.second}`;
}

function formatContentType(object) {
  const contentType = object?.httpMetadata?.contentType;
  return typeof contentType === "string" && contentType.trim()
    ? contentType.trim()
    : "application/octet-stream";
}

function filesPage({ objects, accessKeys, showAll, nextCursor, nextToken, displayTimeZone, uploadedFormatter }) {
  const timeZoneLabel = displayTimeZone === DEFAULT_DISPLAY_TIME_ZONE
    ? "GMT+8"
    : displayTimeZone;
  const rows = objects.map((object) => {
    const requiredKey = requiredKeyFor(accessKeys, object.key);
    const href = objectHref(object.key, requiredKey);
    const downloadHref = objectDownloadHref(object.key, requiredKey);
    const filename = objectFilename(object.key);
    const visibility = requiredKey ? "Protected" : "Public";
    const type = escapeHtml(formatContentType(object));
    const size = escapeHtml(formatSize(object.size));
    const uploaded = escapeHtml(formatUploaded(object.uploaded, uploadedFormatter));
    return `<li class="file-row"><div class="file-main" title="${escapeHtml(object.key)}">
      <span class="file-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4V20H7Z"/><path d="M14 3.5V8h4M10 12h5M10 15h5"/></svg></span>
      <span class="object-cell"><span class="object-name">${escapeHtml(object.key)}</span><span class="object-meta">${type} · ${size} · ${uploaded} ${escapeHtml(timeZoneLabel)}</span></span>
      <span class="access-badge ${requiredKey ? "protected" : "public"}">${visibility}</span>
      <span class="type-cell" title="${type}">${type}</span>
      <span class="size-cell">${size}</span>
      <span class="date-cell">${uploaded}</span>
    </div><a class="open-button" href="${escapeHtml(href)}" rel="noreferrer" aria-label="Open ${escapeHtml(object.key)}" title="Open ${escapeHtml(object.key)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 21H4V3h9l5 5v5M13 3v5h5"/><path d="M21 16h-6v6M15 16l7 7"/></svg><span class="open-label">Open</span></a><a class="download-button" href="${escapeHtml(downloadHref)}" download="${escapeHtml(filename)}" rel="noreferrer" aria-label="Download ${escapeHtml(object.key)}" title="Download ${escapeHtml(object.key)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"></path></svg><span class="download-label">Download</span></a></li>`;
  }).join("");

  let nextLink = "";
  if (nextCursor) {
    const params = new URLSearchParams();
    params.set("cursor", nextCursor);
    if (showAll) params.set("token", nextToken);
    nextLink = `<div class="pagination"><a class="next-button" href="${escapeHtml(`${FILES_PATH}?${params}`)}" rel="noreferrer">Next page <span aria-hidden="true">→</span></a></div>`;
  }

  const scope = showAll ? "All files" : "Public files";
  const emptyMessage = showAll ? "No files on this page." : "No public files on this page.";
  const note = showAll
    ? `<p class="security-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>Protected links contain an access key.</p>`
    : "";
  const content = `<section class="files-view"><header class="page-header"><div><p class="eyebrow">${showAll ? "Authorized scope" : "Public scope"}</p><h1>${scope}</h1></div><span class="scope-chip">${showAll ? "Protected" : "Public"}</span></header>
    ${note}
    ${rows ? `<section class="file-list" aria-label="${scope}"><div class="file-list-head" aria-hidden="true"><span class="file-list-head-main"><span></span><span>Object key</span><span>Access</span><span>Type</span><span>Size</span><span>Uploaded (${escapeHtml(timeZoneLabel)})</span></span><span>Open</span><span>Download</span></div><ul>${rows}</ul></section>` : `<p class="empty">${emptyMessage}</p>`}
    ${nextLink}</section>`;
  return appPage({ title: scope, activePage: "files", topMeta: showAll ? "Protected access" : "Public access", content });
}

function rootPage() {
  const content = `<section class="status-view"><header class="page-header"><div><p class="eyebrow">Service</p><h1>Status</h1></div></header><div class="status-card"><span class="status-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12 3.5 3.5 7.5-8"/></svg></span><p class="status-message">${SUCCESS_MESSAGE}</p><span class="ready-badge">READY</span></div></section>`;
  return appPage({ title: "Status", activePage: "status", content });
}

function errorPage(status, messages) {
  const issues = Array.isArray(messages) ? messages : [messages];
  const issueContent = issues.length === 1
    ? `<p class="status-message">${escapeHtml(issues[0])}</p>`
    : `<p class="status-message">${issues.length} configuration issues found</p><ul class="status-issues">${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`;
  const content = `<section class="status-view"><header class="page-header"><div><p class="eyebrow">Service error</p><h1>Status</h1></div></header><div class="status-card error"><span class="status-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><path d="M10.3 4.7 3.8 16a2 2 0 0 0 1.7 3h13a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z"/></svg></span><div class="status-copy">${issueContent}<p class="status-detail">Return to Status after resolving the error. Files navigation is disabled on this page.</p></div><span class="ready-badge">ERROR ${status}</span></div></section>`;
  return appPage({ title: `Error ${status}`, activePage: "status", content, filesEnabled: false });
}

function errorResponse(status, messages, isHead = false, extraHeaders = {}) {
  const headers = new Headers(ERROR_HEADERS);
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers.set(name, value);
  }
  return new Response(isHead ? null : errorPage(status, messages), { status, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, allow: "GET, HEAD, OPTIONS" },
      });
    }

    const isHead = request.method === "HEAD";
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "Method Not Allowed", false, { allow: "GET, HEAD, OPTIONS" });
    }

    const url = new URL(request.url);

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") {
      return new Response(isHead ? null : FAVICON_SVG, {
        headers: {
          ...CORS_HEADERS,
          "cache-control": "public, max-age=86400",
          "content-type": "image/svg+xml; charset=utf-8",
        },
      });
    }

    const configurationIssues = [];
    if (
      !env.BUCKET ||
      typeof env.BUCKET.get !== "function" ||
      typeof env.BUCKET.head !== "function" ||
      typeof env.BUCKET.list !== "function"
    ) {
      configurationIssues.push("R2 bucket binding is not configured");
    }

    let accessKeys;
    if (typeof env.ACCESS_KEYS !== "string" || !env.ACCESS_KEYS.trim()) {
      configurationIssues.push("ACCESS_KEYS variable is not configured");
    } else {
      try {
        accessKeys = JSON.parse(env.ACCESS_KEYS);
        if (
          accessKeys === null ||
          Array.isArray(accessKeys) ||
          typeof accessKeys !== "object" ||
          Object.entries(accessKeys).some(([objectKey, value]) =>
            !objectKey ||
            objectKey.length > MAX_QUERY_VALUE_LENGTH ||
            typeof value !== "string" ||
            !value ||
            value.length > MAX_QUERY_VALUE_LENGTH
          )
        ) {
          throw new Error();
        }
      } catch {
        configurationIssues.push("Invalid ACCESS_KEYS configuration");
      }
    }

    if (typeof env.BROWSE_UUID !== "string" || !env.BROWSE_UUID.trim()) {
      configurationIssues.push("BROWSE_UUID variable is not configured");
    } else if (env.BROWSE_UUID.length > MAX_TOKEN_LENGTH) {
      configurationIssues.push("Invalid BROWSE_UUID configuration");
    }

    let displayTimeZone = DEFAULT_DISPLAY_TIME_ZONE;
    if (env.DISPLAY_TIME_ZONE !== undefined && env.DISPLAY_TIME_ZONE !== null) {
      if (typeof env.DISPLAY_TIME_ZONE !== "string" || !env.DISPLAY_TIME_ZONE.trim()) {
        configurationIssues.push("Invalid DISPLAY_TIME_ZONE configuration");
      } else {
        displayTimeZone = env.DISPLAY_TIME_ZONE.trim();
      }
    }
    let uploadedFormatter;
    try {
      uploadedFormatter = createUploadedFormatter(displayTimeZone);
    } catch {
      configurationIssues.push("Invalid DISPLAY_TIME_ZONE configuration");
    }

    if (configurationIssues.length) {
      return errorResponse(500, [...new Set(configurationIssues)], isHead);
    }

    if (url.pathname === "/") {
      return new Response(isHead ? null : rootPage(), {
        headers: PAGE_HEADERS,
      });
    }

    if (url.pathname === FILES_PATH && !url.searchParams.has("object")) {
      if (url.searchParams.has("download")) {
        return errorResponse(400, "Bad Request", isHead);
      }
      const uuidValues = url.searchParams.getAll("uuid");
      const tokenValues = url.searchParams.getAll("token");
      const cursorValues = url.searchParams.getAll("cursor");
      if (
        cursorValues.length > 1 ||
        tokenValues.length > 1 ||
        (cursorValues.length === 1 && cursorValues[0].length > MAX_QUERY_VALUE_LENGTH) ||
        (tokenValues.length === 1 && tokenValues[0].length > MAX_TOKEN_LENGTH)
      ) {
        return errorResponse(400, "Bad Request", isHead);
      }

      const showAll = uuidValues.length > 0 || tokenValues.length > 0;
      if (showAll) {
        let authorized = false;
        if (uuidValues.length === 1 && tokenValues.length === 0) {
          authorized = timingSafeEqual(uuidValues[0], env.BROWSE_UUID);
        } else if (
          uuidValues.length === 0 &&
          tokenValues.length === 1 &&
          cursorValues.length === 1 &&
          cursorValues[0]
        ) {
          const expectedToken = await cursorAccessToken(env.BROWSE_UUID, cursorValues[0]);
          authorized = timingSafeEqual(tokenValues[0], expectedToken);
        }
        if (!authorized) {
          return errorResponse(403, "Forbidden", isHead);
        }
      }

      if (isHead) {
        return new Response(null, { headers: FILES_HEADERS });
      }

      const options = { limit: FILES_PER_PAGE, include: ["httpMetadata"] };
      if (cursorValues.length === 1 && cursorValues[0]) {
        options.cursor = cursorValues[0];
      }

      try {
        const result = await env.BUCKET.list(options);
        if (!result || !Array.isArray(result.objects)) {
          throw new Error("Invalid R2 list response");
        }

        const objects = result.objects.filter((object) => {
          if (!object || typeof object.key !== "string") {
            throw new Error("Invalid R2 object metadata");
          }
          return showAll || !requiredKeyFor(accessKeys, object.key);
        });
        if (
          result.truncated &&
          (
            typeof result.cursor !== "string" ||
            !result.cursor ||
            result.cursor.length > MAX_QUERY_VALUE_LENGTH ||
            result.cursor === options.cursor
          )
        ) {
          throw new Error("Invalid R2 pagination cursor");
        }
        const nextCursor = result.truncated ? result.cursor : "";
        const nextToken = nextCursor && showAll
          ? await cursorAccessToken(env.BROWSE_UUID, nextCursor)
          : "";
        const body = filesPage({
          objects,
          accessKeys,
          showAll,
          nextCursor,
          nextToken,
          displayTimeZone,
          uploadedFormatter,
        });
        return new Response(body, { headers: FILES_HEADERS });
      } catch (error) {
        console.error("R2 list failed", error);
        return errorResponse(500, "Internal Server Error", isHead);
      }
    }

    const objectValues = url.pathname === FILES_PATH
      ? url.searchParams.getAll("object")
      : [];
    if (
      objectValues.length > 1 ||
      (objectValues.length === 1 && (
        !objectValues[0] ||
        objectValues[0].length > MAX_QUERY_VALUE_LENGTH ||
        url.searchParams.has("uuid") ||
        url.searchParams.has("cursor") ||
        url.searchParams.has("token")
      ))
    ) {
      return errorResponse(400, "Bad Request", isHead);
    }

    let objectKey;
    if (objectValues.length === 1) {
      objectKey = objectValues[0];
    } else {
      try {
        objectKey = decodeURIComponent(url.pathname.slice(1));
      } catch {
        return errorResponse(400, "Bad Request", isHead);
      }
    }
    if (!objectKey || objectKey.length > MAX_QUERY_VALUE_LENGTH) {
      return errorResponse(400, "Bad Request", isHead);
    }
    const downloadValues = url.searchParams.getAll("download");
    if (
      downloadValues.length > 1 ||
      (downloadValues.length === 1 && downloadValues[0] !== "1")
    ) {
      return errorResponse(400, "Bad Request", isHead);
    }
    const downloadRequested = downloadValues.length === 1;
    const requiredKey = requiredKeyFor(accessKeys, objectKey);

    if (typeof requiredKey !== "string") {
      return errorResponse(500, "Invalid ACCESS_KEYS configuration", isHead);
    }

    if (requiredKey) {
      const keyValues = url.searchParams.getAll("key");
      if (
        keyValues.length !== 1 ||
        !timingSafeEqual(keyValues[0], requiredKey, MAX_QUERY_VALUE_LENGTH)
      ) {
        return errorResponse(403, "Forbidden", isHead);
      }
    }

    try {
      const object = isHead
        ? await env.BUCKET.head(objectKey)
        : await env.BUCKET.get(objectKey);

      if (object === null) {
        return errorResponse(404, "Not Found", isHead);
      }

      const headers = new Headers(CORS_HEADERS);
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      if (downloadRequested) {
        headers.set("content-disposition", contentDisposition(objectKey));
      }
      if (requiredKey) {
        headers.set("cache-control", "private, no-store");
        headers.set("referrer-policy", "no-referrer");
        headers.set("x-content-type-options", "nosniff");
      }

      return new Response(isHead ? null : object.body, { headers });
    } catch (error) {
      console.error("R2 read failed", error);
      return errorResponse(500, "Internal Server Error", isHead);
    }
  },
};
