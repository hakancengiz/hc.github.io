import { readFile } from "node:fs/promises";
import { writeRssCheck } from "./lib/rss-check.mjs";
import {
  parseFeed,
  normalizePost,
  savePosts,
  RSS_URL,
} from "./lib/content.mjs";

async function main() {
  let posts;
  const file = process.argv.indexOf("--input");
  if (file !== -1) {
    if (!process.argv[file + 1])
      throw new Error("--input için bir RSS XML dosyası gerekiyor.");
    posts = parseFeed(await readFile(process.argv[file + 1], "utf8"));
  } else {
    try {
      const response = await fetch(RSS_URL, {
        signal: AbortSignal.timeout(25000),
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (!response.ok) throw new Error(`RSS: HTTP ${response.status}`);
      posts = parseFeed(await response.text());
    } catch (error) {
      console.warn(`${error.message} Alternatif akış deneniyor.`);
      const response = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`,
        { signal: AbortSignal.timeout(25000) },
      );
      if (!response.ok)
        throw new Error(`Alternatif akış: HTTP ${response.status}`);
      const data = await response.json();
      if (data.status !== "ok" || !Array.isArray(data.items))
        throw new Error("Akış okunamadı; mevcut arşiv korunuyor.");
      posts = data.items.map((item) => normalizePost(item)).filter(Boolean);
    }
  }
  if (!posts.length)
    throw new Error("Yayımlanmış yazı bulunamadı; mevcut arşiv korunuyor.");
  const result = await savePosts(posts);
  const latest = await writeRssCheck(posts);
  console.log(`RSS kontrol: ${latest.title}`);
  console.log(
    `${posts.length} yazı kontrol edildi. Arşiv: ${result.count} yazı. ${result.changed ? "Güncellendi." : "Değişiklik yok."}`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
