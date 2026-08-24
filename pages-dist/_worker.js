const SUCCESS_MESSAGE = "R2Gate is running successfully.";
const GITHUB_URL = "https://github.com/Fiatnorm/R2Gate";
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

function rootPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>R2Gate</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #111827; color: #f9fafb; }
    main { max-width: 34rem; padding: 2.5rem; text-align: center; }
    h1 { margin: 0 0 .75rem; font-size: clamp(2rem, 8vw, 4rem); }
    p { margin: 0 0 1.5rem; color: #d1d5db; }
    a { color: #ff9b20; font-weight: 650; text-underline-offset: .25em; }
    a:hover { color: #ffb552; }
  </style>
</head>
<body>
  <main>
    <h1>R2Gate</h1>
    <p>${SUCCESS_MESSAGE}</p>
    <a href="${GITHUB_URL}">View R2Gate on GitHub</a>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const isHead = request.method === "HEAD";

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") {
      return new Response(isHead ? null : FAVICON_SVG, {
        headers: {
          "cache-control": "public, max-age=86400",
          "content-type": "image/svg+xml; charset=utf-8",
        },
      });
    }

    if (
      !env.BUCKET ||
      typeof env.BUCKET.get !== "function" ||
      typeof env.BUCKET.head !== "function"
    ) {
      return new Response("R2 bucket binding is not configured", { status: 500 });
    }

    if (typeof env.ACCESS_KEYS !== "string" || !env.ACCESS_KEYS.trim()) {
      return new Response("ACCESS_KEYS variable is not configured", { status: 500 });
    }

    let accessKeys;
    try {
      accessKeys = JSON.parse(env.ACCESS_KEYS);
      if (accessKeys === null || Array.isArray(accessKeys) || typeof accessKeys !== "object") {
        throw new Error();
      }
    } catch {
      return new Response("Invalid ACCESS_KEYS configuration", { status: 500 });
    }

    if (url.pathname === "/") {
      return new Response(isHead ? null : rootPage(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const objectKey = url.pathname.slice(1);
    const requiredKey = Object.hasOwn(accessKeys, objectKey) ? accessKeys[objectKey] : "";

    if (typeof requiredKey !== "string") {
      return new Response("Invalid ACCESS_KEYS configuration", { status: 500 });
    }

    if (requiredKey && url.searchParams.get("key") !== requiredKey) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const object = isHead
        ? await env.BUCKET.head(objectKey)
        : await env.BUCKET.get(objectKey);

      if (object === null) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);

      return new Response(isHead ? null : object.body, { headers });
    } catch (error) {
      console.error("R2 read failed", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
