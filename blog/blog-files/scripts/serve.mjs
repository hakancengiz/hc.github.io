import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, extname } from "node:path";
import { BLOG_ROOT } from "./lib/content.mjs";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (/^\/yazilar\//.test(pathname)) {
      const url = new URL(request.url, "http://localhost");
      response.writeHead(302, { Location: `/blog-files${url.pathname}${url.search}` }).end();
      return;
    }
    const parts = pathname.split(/[\\/]/);
    if (
      parts.some(
        (part) =>
          part.startsWith(".") || ["node_modules", "imports"].includes(part),
      ) ||
      pathname.endsWith(".zip")
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    let path = resolve(BLOG_ROOT, `.${pathname}`);
    const rel = relative(BLOG_ROOT, path);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
const port = Number(process.env.PORT || 4187);
server.listen(port, "127.0.0.1", () =>
  console.log(`Blog: http://127.0.0.1:${port}`),
);
