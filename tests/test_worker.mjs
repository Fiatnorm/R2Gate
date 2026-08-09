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


function makeBucket({ missing = [], failing = [] } = {}) {
  const calls = { get: [], head: [] };

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
    ACCESS_KEYS: "not-json",
  });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Invalid ACCESS_KEYS configuration");

  response = await worker.fetch(new Request("https://example.com/"), {
    BUCKET: bucket,
    ACCESS_KEYS: "{}",
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "R2Gate is running successfully.");
});


test("file access handles keys, GET, HEAD, 404, and 405", async () => {
  const bucket = makeBucket({ missing: ["missing.txt"] });
  const env = {
    BUCKET: bucket,
    ACCESS_KEYS: JSON.stringify({ "private.txt": "file-key" }),
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
    });
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Internal Server Error");
  } finally {
    console.error = originalError;
  }
});
