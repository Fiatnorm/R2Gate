const SUCCESS_MESSAGE = "R2Gate is running successfully.";
const GITHUB_URL = "https://github.com/Fiatnorm/R2Gate";
const FILES_PATH = "/_files";
const FILES_PER_PAGE = 200;
const MAX_QUERY_VALUE_LENGTH = 4096;
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

const FILES_HEADERS = {
  "cache-control": "private, no-store",
  "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "content-type": "text/html; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive",
};
const FILES_ERROR_HEADERS = {
  ...FILES_HEADERS,
  "content-type": "text/plain; charset=utf-8",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function timingSafeEqual(left, right) {
  if (
    typeof left !== "string" ||
    typeof right !== "string" ||
    left.length > 128 ||
    right.length > 128
  ) {
    return false;
  }

  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return difference === 0;
}

async function cursorAccessToken(secret, cursor) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(cursor)));
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

function formatUploaded(uploaded) {
  const date = uploaded instanceof Date ? uploaded : new Date(uploaded);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toISOString();
}

function filesPage({ objects, accessKeys, showAll, nextCursor, nextToken }) {
  const rows = objects.map((object) => {
    const requiredKey = requiredKeyFor(accessKeys, object.key);
    const href = objectHref(object.key, requiredKey);
    const visibility = requiredKey ? "Protected" : "Public";
    return `<li>
      <a href="${escapeHtml(href)}" rel="noreferrer">${escapeHtml(object.key)}</a>
      <span class="badge ${requiredKey ? "protected" : "public"}">${visibility}</span>
      <small>${escapeHtml(formatSize(object.size))} · ${escapeHtml(formatUploaded(object.uploaded))}</small>
    </li>`;
  }).join("");

  let nextLink = "";
  if (nextCursor) {
    const params = new URLSearchParams();
    params.set("cursor", nextCursor);
    if (showAll) params.set("token", nextToken);
    nextLink = `<a class="next" href="${escapeHtml(`${FILES_PATH}?${params}`)}" rel="noreferrer">Next page →</a>`;
  }

  const scope = showAll ? "All files" : "Public files";
  const emptyMessage = showAll ? "No files on this page." : "No public files on this page.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${scope} · R2Gate</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { min-height: 100vh; margin: 0; background: #111827; color: #f9fafb; }
    main { width: min(60rem, calc(100% - 2rem)); margin: 0 auto; padding: 3rem 0; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
    h1 { margin: 0; font-size: clamp(2rem, 7vw, 3.5rem); }
    header a, .next { color: #ff9b20; font-weight: 650; text-underline-offset: .25em; }
    ul { margin: 0; padding: 0; list-style: none; border: 1px solid #374151; border-radius: .75rem; overflow: hidden; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .35rem 1rem; padding: 1rem; background: #1f2937; }
    li + li { border-top: 1px solid #374151; }
    li > a { min-width: 0; overflow-wrap: anywhere; color: #f9fafb; font-weight: 650; }
    small { grid-column: 1 / -1; color: #9ca3af; }
    .badge { align-self: start; padding: .15rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 700; }
    .public { color: #86efac; background: #14532d; }
    .protected { color: #fde68a; background: #713f12; }
    .empty { padding: 2rem; border: 1px solid #374151; border-radius: .75rem; color: #d1d5db; text-align: center; }
    .next { display: inline-block; margin-top: 1.5rem; }
    @media (max-width: 36rem) { header { align-items: start; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>${scope}</h1><small>Up to ${FILES_PER_PAGE} objects per page</small></div>
      <a href="/" rel="noreferrer">R2Gate home</a>
    </header>
    ${rows ? `<ul>${rows}</ul>` : `<p class="empty">${emptyMessage}</p>`}
    ${nextLink}
  </main>
</body>
</html>`;
}

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
    <a href="/_files">Browse public files</a> · <a href="${GITHUB_URL}">View on GitHub</a>
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
      if (
        accessKeys === null ||
        Array.isArray(accessKeys) ||
        typeof accessKeys !== "object" ||
        Object.values(accessKeys).some((value) => typeof value !== "string")
      ) {
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

    if (url.pathname === FILES_PATH && !url.searchParams.has("object")) {
      if (typeof env.BUCKET.list !== "function") {
        return new Response("R2 bucket listing is not configured", {
          status: 500,
          headers: FILES_ERROR_HEADERS,
        });
      }

      const uuidValues = url.searchParams.getAll("uuid");
      const tokenValues = url.searchParams.getAll("token");
      const cursorValues = url.searchParams.getAll("cursor");
      if (
        cursorValues.length > 1 ||
        tokenValues.length > 1 ||
        (cursorValues.length === 1 && cursorValues[0].length > MAX_QUERY_VALUE_LENGTH) ||
        (tokenValues.length === 1 && tokenValues[0].length > 128)
      ) {
        return new Response("Bad Request", { status: 400, headers: FILES_ERROR_HEADERS });
      }

      const showAll = uuidValues.length > 0 || tokenValues.length > 0;
      if (showAll) {
        if (typeof env.BROWSE_UUID !== "string" || !env.BROWSE_UUID.trim()) {
          return new Response("BROWSE_UUID secret is not configured", {
            status: 500,
            headers: FILES_ERROR_HEADERS,
          });
        }
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
          return new Response("Forbidden", { status: 403, headers: FILES_ERROR_HEADERS });
        }
      }

      if (isHead) {
        return new Response(null, { headers: FILES_HEADERS });
      }

      const options = { limit: FILES_PER_PAGE };
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
        const nextCursor = result.truncated && typeof result.cursor === "string"
          ? result.cursor
          : "";
        const nextToken = nextCursor && showAll
          ? await cursorAccessToken(env.BROWSE_UUID, nextCursor)
          : "";
        const body = filesPage({
          objects,
          accessKeys,
          showAll,
          nextCursor,
          nextToken,
        });
        return new Response(body, { headers: FILES_HEADERS });
      } catch (error) {
        console.error("R2 list failed", error);
        return new Response("Internal Server Error", {
          status: 500,
          headers: FILES_ERROR_HEADERS,
        });
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
      return new Response("Bad Request", {
        status: 400,
        headers: FILES_ERROR_HEADERS,
      });
    }

    const objectKey = objectValues.length === 1 ? objectValues[0] : url.pathname.slice(1);
    const requiredKey = requiredKeyFor(accessKeys, objectKey);

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
      if (requiredKey) {
        headers.set("cache-control", "private, no-store");
        headers.set("referrer-policy", "no-referrer");
        headers.set("x-content-type-options", "nosniff");
      }

      return new Response(isHead ? null : object.body, { headers });
    } catch (error) {
      console.error("R2 read failed", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
