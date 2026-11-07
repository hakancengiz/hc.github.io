import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_ROOT, FILES_ROOT, readArchive, writeIfChanged } from "./lib/content.mjs";
import { assignSlugs, articlePath } from "./lib/routes.mjs";
import { renderRedirect } from "./build-articles.mjs";

export async function buildRedirects(output) {
  if (!output) throw new Error("Yayın paketindeki blog klasörünü belirtin.");
  const target = resolve(output);
  if ([resolve(BLOG_ROOT), resolve(FILES_ROOT)].includes(target))
    throw new Error("Eski adresler yalnızca ayrı bir yayın paketine yazılabilir.");
  const archive = await readArchive();
  const saved = JSON.parse(await readFile(resolve(FILES_ROOT, "data/routes.json"), "utf8"));
  const routes = assignSlugs(archive.posts, saved.routes);
  for (const post of archive.posts) {
    const item = { ...post, slug: routes[post.id] };
    const html = renderRedirect(item, `../../${articlePath(item)}`);
    await writeIfChanged(resolve(target, "yazilar", item.id, "index.html"), html);
  }
  console.log(`${archive.posts.length} eski makale adresi için yönlendirme hazır.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildRedirects(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
