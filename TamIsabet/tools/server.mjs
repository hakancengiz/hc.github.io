import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {extname, join, normalize} from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || 4173);
const requestedBase = process.argv[3] || "";
const base = requestedBase ? `/${requestedBase.replace(/^\/+|\/+$/g, "")}` : "";
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png"};

createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (base) {
      if (pathname === base || pathname === `${base}/`) pathname = "/";
      else if (pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length);
      else throw new Error("Outside configured base path");
    }
    let file = normalize(join(root, pathname === "/" ? "index.html" : pathname.slice(1)));
    if (!file.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {"Content-Type":types[extname(file)] || "application/octet-stream","Cache-Control":"no-store"});
    response.end(body);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}${base}/`));