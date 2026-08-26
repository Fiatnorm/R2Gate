import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker.mjs";


function makeObject(key) {
  return {
    body: `body:${key}`,
    httpEtag: `etag-${encodeURIComponent(key)}`,
    writeHttpMetadata(headers) {
      headers.set("content-type", "text/plain");
    },
  };
}


function makeListedObject(key, size = 128) {
  return {
    key,
    size,
    uploaded: new Date("2026-08-25T00:00:00.000Z"),
    httpMetadata: { contentType: "text/plain" },
  };
}


async function assertErrorPage(response, status, messages) {
  const expectedMessages = Array.isArray(messages) ? messages : [messages];
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(response.headers.get("access-control-max-age"), "86400");
  const body = await response.text();
  assert.match(body, /<h1>Status<\/h1>/);
  for (const message of expectedMessages) assert.ok(body.includes(message));
  if (expectedMessages.length > 1) {
    assert.ok(body.includes(`${expectedMessages.length} configuration issues found`));
    assert.equal((body.match(/<li>/g) || []).length, expectedMessages.length);
  }
  assert.match(body, new RegExp(`ERROR ${status}`));
  assert.match(body, /class="nav-item disabled" aria-disabled="true"[\s\S]*Files/);
  assert.doesNotMatch(body, /href="\/_files"/);
  assert.match(body, /href="https:\/\/raw\.githubusercontent\.com\/Fiatnorm\/R2Gate\/refs\/heads\/main\/LICENSE" target="_blank" rel="noopener noreferrer"/);
}


function makeBucket({
  missing = [],
  failing = [],
  listed = [],
  listPages = {},
  listFailing = false,
} = {}) {
  const calls = { get: [], head: [], list: [] };

  return {
    calls,
    async get(key) {
      calls.get.push(key);
      if (failing.includes(key)) throw new Error("R2 unavailable");
      return missing.includes(key) ? null : makeObject(key);
    },
    async head(key) {
      calls.head.push(key);
      if (failing.includes(key)) throw new Error("R2 unavailable");
      return missing.includes(key) ? null : makeObject(key);
    },
    async list(options = {}) {
      calls.list.push({ ...options });
      if (listFailing) throw new Error("R2 unavailable");
      const cursor = options.cursor || "";
      return Object.hasOwn(listPages, cursor)
        ? listPages[cursor]
        : { objects: listed, truncated: false };
    },
  };
}


test("root reports deployment configuration", async () => {
  let response = await worker.fetch(new Request("https://example.com/"), {});
  await assertErrorPage(response, 500, [
    "R2 bucket binding is not configured",
    "ACCESS_KEYS variable is not configured",
    "BROWSE_UUID variable is not configured",
  ]);

  const bucket = makeBucket();
  response = await worker.fetch(new Request("https://example.com/"), { BUCKET: bucket });
  await assertErrorPage(response, 500, [
    "ACCESS_KEYS variable is not configured",
    "BROWSE_UUID variable is not configured",
  ]);

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
  });
  await assertErrorPage(response, 500, "BROWSE_UUID variable is not configured");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "not-json",
    BROWSE_UUID: "browse-uuid",
  });
  await assertErrorPage(response, 500, "Invalid ACCESS_KEYS configuration");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": 123 }),
    BROWSE_UUID: "browse-uuid",
  });
  await assertErrorPage(response, 500, "Invalid ACCESS_KEYS configuration");

  for (const invalidAccessKeys of [
    { "private.txt": "" },
    { "": "file-key" },
    { "private.txt": "x".repeat(4097) },
  ]) {
    response = await worker.fetch(new Request("https://example.com/"), {
      BUCKET: bucket,
      ACCESS_KEYS: JSON.stringify(invalidAccessKeys),
      BROWSE_UUID: "browse-uuid",
    });
    await assertErrorPage(response, 500, "Invalid ACCESS_KEYS configuration");
  }

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
    BROWSE_UUID: "x".repeat(129),
  });
  await assertErrorPage(response, 500, "Invalid BROWSE_UUID configuration");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "not-json",
    DISPLAY_TIME_ZONE: "Not/A_Time_Zone",
  });
  await assertErrorPage(response, 500, [
    "Invalid ACCESS_KEYS configuration",
    "BROWSE_UUID variable is not configured",
    "Invalid DISPLAY_TIME_ZONE configuration",
  ]);

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
    BROWSE_UUID: "browse-uuid",
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const body = await response.text();
  assert.match(body, /R2Gate is running successfully\./);
  assert.match(body, /<h1>Status<\/h1>/);
  assert.match(body, /class="nav-item active" aria-current="page"[\s\S]*Status/);
  assert.match(body, /href="\/_files"[\s\S]*Files/);
  assert.match(body, /href="https:\/\/github\.com\/Fiatnorm\/R2Gate" target="_blank" rel="noopener noreferrer"/);
  assert.match(body, /href="https:\/\/raw\.githubusercontent\.com\/Fiatnorm\/R2Gate\/refs\/heads\/main\/LICENSE" target="_blank" rel="noopener noreferrer"/);
  assert.match(body, /href="\/favicon\.svg"/);
  assert.match(body, /id="brand-orange"/);
  assert.match(body, /\.files-view, \.status-view \{ width: min\(960px, 100%\); margin: 0 auto; \}/);
  assert.match(body, /\.status-view \{ display: grid; align-content: center; min-height: calc\(100vh - 240px\); \}/);
  assert.doesNotMatch(body, /class="file-list"/);

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: { get: bucket.get, head: bucket.head },
    ACCESS_KEYS: "{}",
    BROWSE_UUID: "browse-uuid",
  });
  await assertErrorPage(response, 500, "R2 bucket binding is not configured");
});


test("favicon is available without R2 configuration", async () => {
  let response = await worker.fetch(new Request("https://example.com/favicon.svg"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/svg\+xml/);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(await response.text(), /^<svg[\s\S]*<\/svg>$/);

  response = await worker.fetch(
    new Request("https://example.com/favicon.ico", { method: "HEAD" }),
    {},
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});


test("OPTIONS returns global CORS headers without touching configuration", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/private.txt?key=unverified", {
      method: "OPTIONS",
      headers: {
        Origin: "https://optidomain.example",
        "Access-Control-Request-Method": "GET",
      },
    }),
    {},
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(response.headers.get("access-control-max-age"), "86400");
});


test("file access handles CORS, keys, downloads, GET, HEAD, 404, and 405", async () => {
  const bucket = makeBucket({ missing: ["missing.txt"] });
  const env = {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": "file-key" }),
    BROWSE_UUID: "browse-uuid",
  };

  let response = await worker.fetch(new Request("https://example.com/private.txt"), env);
  await assertErrorPage(response, 403, "Forbidden");
  assert.equal(bucket.calls.get.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "body:private.txt");
  assert.equal(response.headers.get("etag"), "etag-private.txt");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");

  response = await worker.fetch(
    new Request("https://example.com/public.txt?download=1"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), "attachment; filename=\"public.txt\"; filename*=UTF-8''public.txt");
  assert.equal(await response.text(), "body:public.txt");

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&key=file-key&download=1"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), "attachment; filename=\"private.txt\"; filename*=UTF-8''private.txt");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(await response.text(), "body:private.txt");

  response = await worker.fetch(
    new Request("https://example.com/_files?object=folder%2F%E6%8A%A5%E5%91%8A%20%22Q%22.txt&download=1"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    "attachment; filename=\"__ _Q_.txt\"; filename*=UTF-8''%E6%8A%A5%E5%91%8A%20%22Q%22.txt",
  );

  response = await worker.fetch(
    new Request("https://example.com/folder/%E6%8A%A5%E5%91%8A%20%22Q%22.txt"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'body:folder/报告 "Q".txt');

  const readsBeforeInvalidPath = bucket.calls.get.length;
  response = await worker.fetch(new Request("https://example.com/bad%ZZpath"), env);
  await assertErrorPage(response, 400, "Bad Request");
  assert.equal(bucket.calls.get.length, readsBeforeInvalidPath);

  const readsBeforeInvalidDownload = bucket.calls.get.length;
  response = await worker.fetch(
    new Request("https://example.com/public.txt?download=0"),
    env,
  );
  await assertErrorPage(response, 400, "Bad Request");
  assert.equal(bucket.calls.get.length, readsBeforeInvalidDownload);

  response = await worker.fetch(
    new Request("https://example.com/public.txt?download=1&download=1"),
    env,
  );
  await assertErrorPage(response, 400, "Bad Request");
  assert.equal(bucket.calls.get.length, readsBeforeInvalidDownload);

  const readsAfterAuthorizedGet = bucket.calls.get.length;
  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key&key=file-key"),
    env,
  );
  await assertErrorPage(response, 403, "Forbidden");
  assert.equal(bucket.calls.get.length, readsAfterAuthorizedGet);

  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key", { method: "HEAD" }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.deepEqual(bucket.calls.head, ["private.txt"]);

  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key&download=1", { method: "HEAD" }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), "attachment; filename=\"private.txt\"; filename*=UTF-8''private.txt");
  assert.equal(await response.text(), "");

  response = await worker.fetch(new Request("https://example.com/missing.txt"), env);
  await assertErrorPage(response, 404, "Not Found");

  response = await worker.fetch(
    new Request("https://example.com/private.txt", { method: "POST" }),
    env,
  );
  await assertErrorPage(response, 405, "Method Not Allowed");
  assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
});


test("R2 failures return a controlled error", async () => {
  const bucket = makeBucket({ failing: ["error.txt"] });
  const originalError = console.error;
  console.error = () => {};

  try {
    const response = await worker.fetch(new Request("https://example.com/error.txt"), {
      BUCKET: bucket,
      ACCESS_KEYS: "{}",
      BROWSE_UUID: "browse-uuid",
    });
    await assertErrorPage(response, 500, "Internal Server Error");
  } finally {
    console.error = originalError;
  }
});


test("public file listing excludes protected objects and safely links exact keys", async () => {
  const unusualKey = "folder/<script>& ?.txt";
  const bucket = makeBucket({
    listed: [
      makeListedObject("public.txt"),
      makeListedObject("private.txt"),
      makeListedObject(unusualKey, 2048),
    ],
  });
  const env = {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": "file-key" }),
    BROWSE_UUID: "browse-uuid",
  };

  let response = await worker.fetch(new Request("https://example.com/_files"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const body = await response.text();
  assert.match(body, /Public files/);
  assert.match(body, /class="files-view"/);
  assert.match(body, /\.files-view, \.status-view \{ width: min\(960px, 100%\); margin: 0 auto; \}/);
  assert.match(body, /class="file-list"/);
  assert.match(body, /\.file-row:has\(\.file-open:hover\) \{ background: var\(--surface-container-high\); \}/);
  assert.doesNotMatch(body, /\.file-row:hover \{ background:/);
  assert.match(body, /\.download-button:hover \{ box-shadow: 0 8px 18px rgb\(203 194 255 \/ \.28\); filter: brightness\(1\.18\) saturate\(1\.08\); transform: translateY\(-1px\); \}/);
  assert.match(body, /\.download-button:active \{ box-shadow: 0 3px 8px rgb\(203 194 255 \/ \.18\); filter: brightness\(1\.08\); transform: translateY\(0\) scale\(\.96\); \}/);
  assert.match(body, /<span>Object key<\/span><span>Access<\/span><span>Type<\/span><span>Size<\/span><span>Uploaded \(GMT\+8\)<\/span><\/span><span>Download<\/span>/);
  assert.match(body, /text\/plain/);
  assert.match(body, /25 Aug 2026 08:00:00/);
  assert.doesNotMatch(body, /Uploaded \(UTC\)| UTC/);
  assert.doesNotMatch(body, />Open<|open-icon/);
  assert.match(body, /class="nav-item active" aria-current="page"[\s\S]*Files/);
  assert.match(body, /href="https:\/\/github\.com\/Fiatnorm\/R2Gate" target="_blank" rel="noopener noreferrer"/);
  assert.match(body, /href="https:\/\/raw\.githubusercontent\.com\/Fiatnorm\/R2Gate\/refs\/heads\/main\/LICENSE" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(body, /R2Gate is running successfully\./);
  assert.match(body, /href="\/_files\?object=public\.txt"/);
  assert.match(body, /href="\/_files\?object=public\.txt&amp;download=1" download="public\.txt"/);
  assert.doesNotMatch(body, /private\.txt/);
  assert.doesNotMatch(body, /<script>/);
  assert.match(body, /folder\/&lt;script&gt;&amp; \?\.txt/);
  assert.match(body, /object=folder%2F%3Cscript%3E%26\+%3F\.txt/);
  assert.match(body, /object=folder%2F%3Cscript%3E%26\+%3F\.txt&amp;download=1/);
  assert.deepEqual(bucket.calls.list, [{ limit: 200, include: ["httpMetadata"] }]);

  response = await worker.fetch(
    new Request("https://example.com/_files?object=folder%2F%3Cscript%3E%26+%3F.txt"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), `body:${unusualKey}`);
  assert.deepEqual(bucket.calls.get, [unusualKey]);
});


test("file listing supports an optional IANA display time zone", async () => {
  const bucket = makeBucket({ listed: [makeListedObject("public.txt")] });
  const response = await worker.fetch(new Request("https://example.com/_files"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
    BROWSE_UUID: "browse-uuid",
    DISPLAY_TIME_ZONE: "America/New_York",
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Uploaded \(America\/New_York\)/);
  assert.match(body, /24 Aug 2026 20:00:00/);
});


test("UUID listing requires the configured variable and creates working keyed links", async () => {
  const bucket = makeBucket({
    listed: [makeListedObject("public.txt"), makeListedObject("private.txt")],
  });
  const accessKeys = JSON.stringify({ "private.txt": "file-key&value" });

  let response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid"),
    { BUCKET: bucket, ACCESS_KEYS: accessKeys },
  );
  await assertErrorPage(response, 500, "BROWSE_UUID variable is not configured");
  assert.equal(bucket.calls.list.length, 0);

  const env = { BUCKET: bucket, ACCESS_KEYS: accessKeys, BROWSE_UUID: "browse-uuid" };
  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=wrong"),
    env,
  );
  await assertErrorPage(response, 403, "Forbidden");
  assert.equal(bucket.calls.list.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid&uuid=browse-uuid"),
    env,
  );
  await assertErrorPage(response, 403, "Forbidden");
  assert.equal(bucket.calls.list.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid"),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /All files/);
  assert.match(body, /<span class="scope-chip">Protected<\/span>/);
  assert.match(body, /Protected access/);
  assert.doesNotMatch(body, /<span class="scope-chip">All<\/span>|Public \+ Protected/);
  assert.match(body, /Protected links contain an access key\./);
  assert.match(body, /public\.txt/);
  assert.match(body, /private\.txt/);
  assert.match(body, /href="\/_files\?object=private\.txt&amp;key=file-key%26value"/);
  assert.match(body, /href="\/_files\?object=private\.txt&amp;key=file-key%26value&amp;download=1" download="private\.txt"/);
  assert.doesNotMatch(body, /file-key&amp;value/);
  assert.doesNotMatch(body, /browse-uuid/);

  response = await worker.fetch(
    new Request("https://example.com/_files?download=1"),
    env,
  );
  await assertErrorPage(response, 400, "Bad Request");

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt"),
    env,
  );
  await assertErrorPage(response, 403, "Forbidden");

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&uuid=browse-uuid&key=file-key%26value"),
    env,
  );
  await assertErrorPage(response, 400, "Bad Request");

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&key=file-key%26value"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "body:private.txt");

  const readsAfterKeyedQuery = bucket.calls.get.length;
  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&key=file-key%26value&key=file-key%26value"),
    env,
  );
  await assertErrorPage(response, 403, "Forbidden");
  assert.equal(bucket.calls.get.length, readsAfterKeyedQuery);

  const listCalls = bucket.calls.list.length;
  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid", { method: "HEAD" }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(bucket.calls.list.length, listCalls);
});


test("file listing uses bounded cursor pagination and controls R2 errors", async () => {
  const bucket = makeBucket({
    listPages: {
      "": {
        objects: [makeListedObject("first.txt")],
        truncated: true,
        cursor: "next/page+1",
      },
      "next/page+1": {
        objects: [makeListedObject("second.txt")],
        truncated: false,
      },
    },
  });
  const env = { BUCKET: bucket, ACCESS_KEYS: "{}", BROWSE_UUID: "browse-uuid" };

  let response = await worker.fetch(new Request("https://example.com/_files"), env);
  assert.equal(response.status, 200);
  let body = await response.text();
  assert.match(body, /href="\/_files\?cursor=next%2Fpage%2B1"/);

  response = await worker.fetch(
    new Request("https://example.com/_files?cursor=next%2Fpage%2B1"),
    env,
  );
  assert.equal(response.status, 200);
  body = await response.text();
  assert.match(body, /second\.txt/);
  assert.deepEqual(bucket.calls.list, [
    { limit: 200, include: ["httpMetadata"] },
    { limit: 200, include: ["httpMetadata"], cursor: "next/page+1" },
  ]);

  const protectedBucket = makeBucket({
    listPages: {
      "": {
        objects: [makeListedObject("first.txt")],
        truncated: true,
        cursor: "protected-page",
      },
      "protected-page": {
        objects: [makeListedObject("private.txt")],
        truncated: false,
      },
    },
  });
  const protectedEnv = {
    BUCKET: protectedBucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": "private-key" }),
    BROWSE_UUID: "browse-uuid",
  };
  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid"),
    protectedEnv,
  );
  assert.equal(response.status, 200);
  body = await response.text();
  assert.doesNotMatch(body, /browse-uuid/);
  const nextMatch = body.match(/href="(\/_files\?cursor=protected-page&amp;token=[A-Za-z0-9_-]+)"/);
  assert.ok(nextMatch);

  response = await worker.fetch(
    new Request(`https://example.com${nextMatch[1].replace(/&amp;/g, "&")}`),
    protectedEnv,
  );
  assert.equal(response.status, 200);
  body = await response.text();
  assert.match(body, /private\.txt/);
  assert.match(body, /key=private-key/);

  response = await worker.fetch(
    new Request("https://example.com/_files?cursor=protected-page&token=wrong"),
    protectedEnv,
  );
  await assertErrorPage(response, 403, "Forbidden");

  response = await worker.fetch(
    new Request("https://example.com/_files?cursor=one&cursor=two"),
    env,
  );
  await assertErrorPage(response, 400, "Bad Request");

  const invalidPaginationBuckets = [
    makeBucket({
      listPages: { "": { objects: [], truncated: true } },
    }),
    makeBucket({
      listPages: {
        repeated: { objects: [], truncated: true, cursor: "repeated" },
      },
    }),
  ];

  const failingBucket = makeBucket({ listFailing: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    response = await worker.fetch(new Request("https://example.com/_files"), {
      BUCKET: invalidPaginationBuckets[0],
      ACCESS_KEYS: "{}",
      BROWSE_UUID: "browse-uuid",
    });
    await assertErrorPage(response, 500, "Internal Server Error");

    response = await worker.fetch(
      new Request("https://example.com/_files?cursor=repeated"),
      {
        BUCKET: invalidPaginationBuckets[1],
        ACCESS_KEYS: "{}",
        BROWSE_UUID: "browse-uuid",
      },
    );
    await assertErrorPage(response, 500, "Internal Server Error");

    response = await worker.fetch(new Request("https://example.com/_files"), {
      BUCKET: failingBucket,
      ACCESS_KEYS: "{}",
      BROWSE_UUID: "browse-uuid",
    });
    await assertErrorPage(response, 500, "Internal Server Error");
  } finally {
    console.error = originalError;
  }
});
