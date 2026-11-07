import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat, mkdtemp, rm } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { BLOG_ROOT, FILES_ROOT } from "../scripts/lib/content.mjs";
import { buildRedirects } from "../scripts/build-redirects.mjs";

const data = JSON.parse(await readFile(resolve(FILES_ROOT, "data/posts.json"), "utf8"));

test("Blog kökünde ana sayfa, yazi ve blog-files bulunur; sayfaların yerel yolları mevcut dosyalara gider", async () => {
  assert.deepEqual((await readdir(BLOG_ROOT)).sort(), ["blog-files", "index.html", "yazi"]);
  for (const page of ["index.html", ...data.items.map(item => `${item.localUrl}index.html`)]) {
    const path = resolve(BLOG_ROOT, page);
    const { document } = parseHTML(await readFile(path, "utf8"));
    for (const node of document.querySelectorAll("a[href],img[src],script[src],link[href]")) {
      const value = node.getAttribute("src") || node.getAttribute("href");
      if (!value || /^(?:https?:|mailto:|#|data:)/i.test(value)) continue;
      let target = fileURLToPath(new URL(value, pathToFileURL(path)));
      assert.ok(!relative(BLOG_ROOT, target).startsWith(".."), `${page}: ${value}`);
      if ((await stat(target)).isDirectory()) target = resolve(target, "index.html");
      assert.equal((await stat(target)).isFile(), true, `${page}: ${value}`);
    }
  }
});

test("Eski adresler yalnızca yayın paketine yazılır; yeni yola yönlenirken sorgu ve bölüm korunur", async () => {
  await assert.rejects(buildRedirects(BLOG_ROOT));
  await assert.rejects(buildRedirects(FILES_ROOT));
  const output = await mkdtemp(resolve(tmpdir(), "hc-blog-redirects-"));
  try {
    await buildRedirects(output);
    for (const item of data.items) {
      for (const legacy of [`yazilar/${item.id}/`]) {
        const { document } = parseHTML(await readFile(resolve(output, legacy, "index.html"), "utf8"));
        const location = new URL(`https://hcengiz.com/blog/${legacy}?test=1#bolum-2`);
        let destination;
        runInNewContext(document.querySelector("script").textContent, { URL, location: { href: location.href, protocol: location.protocol, search: location.search, hash: location.hash, replace: value => { destination = value; } } });
        assert.equal(destination, `https://hcengiz.com/blog/${item.localUrl}?test=1#bolum-2`);
      }
    }
  } finally {
    assert.ok(output.startsWith(resolve(tmpdir()) + sep));
    await rm(output, { recursive: true, force: true });
  }
});
