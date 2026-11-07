import { resolve } from "node:path";
import { BLOG_ROOT, escape, writeIfChanged } from "./content.mjs";

export async function writeRssCheck(posts, root = BLOG_ROOT) {
  const latest = [...posts]
    .filter(post => typeof post.title === "string" && post.title.trim() && Number.isFinite(Date.parse(post.pubDate)))
    .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate) || String(a.id).localeCompare(String(b.id)))[0];
  if (!latest) throw new Error("RSS kontrolü için güncel yazı bulunamadı.");
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>RSS kontrol</title><style>html{color-scheme:light;background:#fff}body{margin:16px;color:#111;font:16px/1.5 system-ui,sans-serif}</style></head><body>${escape(latest.title)}</body></html>\n`;
  await writeIfChanged(resolve(root, "rsskontrol.html"), html);
  return latest;
}
