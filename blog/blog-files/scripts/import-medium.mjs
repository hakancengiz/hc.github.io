import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { parseExport, savePosts } from "./lib/content.mjs";

const maxFileSize = 5 * 1024 * 1024;
const candidate = name => /(?:^|\/)posts\/[^/]+\.html$/i.test(name) && !/(?:^|\/)draft[_-]/i.test(name);

async function readExportFiles(filename) {
  if ((await stat(filename)).isDirectory()) {
    const folder = join(filename, "posts");
    const entries = [];
    for (const file of await readdir(folder, { withFileTypes: true })) {
      const name = `posts/${file.name}`;
      if (!file.isFile() || !candidate(name)) continue;
      const path = join(folder, file.name);
      if ((await stat(path)).size > maxFileSize) continue;
      entries.push([name, await readFile(path, "utf8")]);
    }
    return entries;
  }
  return Object.entries(unzipSync(new Uint8Array(await readFile(filename)), {
    filter: entry => candidate(entry.name) && entry.originalSize <= maxFileSize,
  })).map(([name, data]) => [name, strFromU8(data)]);
}

const args = process.argv.slice(2);
const filename = args.find((arg) => !arg.startsWith("--"));
if (!filename) {
  console.error(
    'Kullanım: npm run import:medium -- "C:/indirilen/medium-export.zip-veya-klasor" [--write]',
  );
  process.exitCode = 1;
} else {
  try {
    const entries = await readExportFiles(filename);
    const posts = entries
      .map(([name, html]) => parseExport(html, name))
      .filter(Boolean);
    console.log(`${posts.length} yayımlanmış yazı adayı bulundu:`);
    posts.forEach((post) =>
      console.log(`${post.pubDate.slice(0, 10)}  ${post.title}`),
    );
    if (!posts.length)
      throw new Error("Aktarılacak yayımlanmış yazı bulunamadı.");
    if (args.includes("--write")) {
      const result = await savePosts(posts);
      console.log(
        `Aktarım tamamlandı. Arşiv: ${result.count} yazı. Ardından npm run build çalıştırın.`,
      );
    } else {
      console.log(
        "Önizleme tamamlandı; dosya değiştirilmedi. Listeyi kontrol ettikten sonra --write ile aktarabilirsiniz.",
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
