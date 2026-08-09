const SUCCESS_MESSAGE = "R2Gate is running successfully.";

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
      return new Response(isHead ? null : SUCCESS_MESSAGE, {
        headers: { "content-type": "text/plain; charset=utf-8" },
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
