import assert from "node:assert/strict";
import test from "node:test";

import worker from "../worker.mjs";


function makeObject(key) {
  return {
    body: `body:${key}`,
    httpEtag: `etag-${key}`,
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
  };
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
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "R2 bucket binding is not configured");

  const bucket = makeBucket();
  response = await worker.fetch(new Request("https://example.com/"), { BUCKET: bucket });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "ACCESS_KEYS variable is not configured");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
  });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "BROWSE_UUID variable is not configured");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "not-json",
    BROWSE_UUID: "browse-uuid",
  });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Invalid ACCESS_KEYS configuration");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": 123 }),
    BROWSE_UUID: "browse-uuid",
  });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Invalid ACCESS_KEYS configuration");

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
  assert.match(body, /href="\/favicon\.svg"/);
  assert.match(body, /id="brand-orange"/);
  assert.doesNotMatch(body, /class="file-list"/);
});


test("favicon is available without R2 configuration", async () => {
  let response = await worker.fetch(new Request("https://example.com/favicon.svg"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/svg\+xml/);
  assert.match(await response.text(), /^<svg[\s\S]*<\/svg>$/);

  response = await worker.fetch(
    new Request("https://example.com/favicon.ico", { method: "HEAD" }),
    {},
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});


test("file access handles keys, GET, HEAD, 404, and 405", async () => {
  const bucket = makeBucket({ missing: ["missing.txt"] });
  const env = {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": "file-key" }),
    BROWSE_UUID: "browse-uuid",
  };

  let response = await worker.fetch(new Request("https://example.com/private.txt"), env);
  assert.equal(response.status, 403);
  assert.equal(bucket.calls.get.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "body:private.txt");
  assert.equal(response.headers.get("etag"), "etag-private.txt");

  response = await worker.fetch(
    new Request("https://example.com/private.txt?key=file-key", { method: "HEAD" }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.deepEqual(bucket.calls.head, ["private.txt"]);

  response = await worker.fetch(new Request("https://example.com/missing.txt"), env);
  assert.equal(response.status, 404);

  response = await worker.fetch(
    new Request("https://example.com/private.txt", { method: "POST" }),
    env,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
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
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Internal Server Error");
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
  const body = await response.text();
  assert.match(body, /Public files/);
  assert.match(body, /class="file-list"/);
  assert.match(body, /<span>Object key<\/span><span>Access<\/span><span>Size<\/span><span>Uploaded<\/span><span>Open<\/span>/);
  assert.match(body, /class="nav-item active" aria-current="page"[\s\S]*Files/);
  assert.match(body, /href="https:\/\/github\.com\/Fiatnorm\/R2Gate" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(body, /R2Gate is running successfully\./);
  assert.match(body, /href="\/_files\?object=public\.txt"/);
  assert.doesNotMatch(body, /private\.txt/);
  assert.doesNotMatch(body, /<script>/);
  assert.match(body, /folder\/&lt;script&gt;&amp; \?\.txt/);
  assert.match(body, /object=folder%2F%3Cscript%3E%26\+%3F\.txt/);
  assert.deepEqual(bucket.calls.list, [{ limit: 200 }]);

  response = await worker.fetch(
    new Request("https://example.com/_files?object=folder%2F%3Cscript%3E%26+%3F.txt"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), `body:${unusualKey}`);
  assert.deepEqual(bucket.calls.get, [unusualKey]);
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
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "BROWSE_UUID variable is not configured");
  assert.equal(bucket.calls.list.length, 0);

  const env = { BUCKET: bucket, ACCESS_KEYS: accessKeys, BROWSE_UUID: "browse-uuid" };
  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=wrong"),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(bucket.calls.list.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid&uuid=browse-uuid"),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(bucket.calls.list.length, 0);

  response = await worker.fetch(
    new Request("https://example.com/_files?uuid=browse-uuid"),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /All files/);
  assert.match(body, /Protected links contain an access key\./);
  assert.match(body, /public\.txt/);
  assert.match(body, /private\.txt/);
  assert.match(body, /href="\/_files\?object=private\.txt&amp;key=file-key%26value"/);
  assert.doesNotMatch(body, /file-key&amp;value/);
  assert.doesNotMatch(body, /browse-uuid/);

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt"),
    env,
  );
  assert.equal(response.status, 403);

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&uuid=browse-uuid&key=file-key%26value"),
    env,
  );
  assert.equal(response.status, 400);

  response = await worker.fetch(
    new Request("https://example.com/_files?object=private.txt&key=file-key%26value"),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "body:private.txt");

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
    { limit: 200 },
    { limit: 200, cursor: "next/page+1" },
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
  assert.equal(response.status, 403);

  response = await worker.fetch(
    new Request("https://example.com/_files?cursor=one&cursor=two"),
    env,
  );
  assert.equal(response.status, 400);

  const failingBucket = makeBucket({ listFailing: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    response = await worker.fetch(new Request("https://example.com/_files"), {
      BUCKET: failingBucket,
      ACCESS_KEYS: "{}",
      BROWSE_UUID: "browse-uuid",
    });
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Internal Server Error");
  } finally {
    console.error = originalError;
  }
});
