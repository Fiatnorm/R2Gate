// Local preview with synthetic R2 data; no Cloudflare credentials or writes.
import http from "node:http";
import worker from "../worker.mjs";

const port = 8799;
const objects = [
  { key: "public.txt", size: 128, type: "text/plain" },
  { key: "reports/报告 <Q>& ?.pdf", size: 2457600, type: "application/pdf" },
  { key: "releases/r2gate-desktop-preview-2026.10.11.zip", size: 18245248, type: "application/zip" },
  { key: "private.txt", size: 4096, type: "text/plain" },
].map(({ key, size, type }) => ({
  key, size, uploaded: new Date("2026-10-11T02:03:04Z"),
  httpMetadata: { contentType: type },
}));
const object = (key) => objects.some((item) => item.key === key) ? {
  body: `Preview file: ${key}`,
  httpEtag: '"preview"',
  writeHttpMetadata: (headers) => headers.set("content-type", "text/plain; charset=utf-8"),
} : null;
const env = {
  ACCESS_KEYS: JSON.stringify({ "private.txt": "preview-key&value" }),
  BROWSE_UUID: "preview-browse",
  BUCKET: {
    list: async () => ({ objects, truncated: false }),
    get: async (key) => object(key),
    head: async (key) => object(key),
  },
};
http.createServer(async (request, response) => {
  try {
    const result = await worker.fetch(new Request(`http://127.0.0.1:${port}${request.url}`, {
      method: request.method,
    }), env);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end("Local preview failed.");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Status: http://127.0.0.1:${port}/`);
  console.log(`Files: http://127.0.0.1:${port}/_files?uuid=preview-browse`);
});
