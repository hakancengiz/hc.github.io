import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { slugify, assignSlugs, articlePath } from "../scripts/lib/routes.mjs";
import { renderRedirect } from "../scripts/build-articles.mjs";

const first = { id: "abcdef123456", title: "Mülakatlarda En Çok Sorulan 20 Yazılım Farkı (C#/.NET)" };

test("Başlık adresleri Türkçe harfleri ve URL özel karakterlerini dönüştürür", () => {
  assert.equal(slugify(first.title), "mulakatlarda-en-cok-sorulan-20-yazilim-farki-csharp-net");
  assert.equal(slugify("İ I ı i Ş Ğ Ü Ö Ç / C++ & API? # 2026"), "i-i-i-i-s-g-u-o-c-cpp-api-2026");
  assert.equal(slugify("  bir\u00a0\u00a0yazı —— adı "), "bir-yazi-adi");
  assert.equal(slugify("../?#💻"), "yazi");
  assert.equal(slugify("CON"), "yazi-con");
  assert.match(slugify("Çok uzun başlık ".repeat(100)), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(slugify("Çok uzun başlık ".repeat(100)).length <= 110);
  assert.throws(() => articlePath({ ...first, slug: "../escape" }));
});

test("Çakışan başlıklar ayrılır; başlık değişse de yayımlanmış adres korunur", () => {
  const second = { id: "bbbbbb123456", title: first.title };
  const routes = assignSlugs([second, first]);
  assert.equal(routes[first.id], slugify(first.title));
  assert.equal(routes[second.id], `${slugify(first.title)}-${second.id}`);
  assert.deepEqual(assignSlugs([first, second]), routes);
  assert.deepEqual(assignSlugs([{ ...first, title: "Yeni başlık" }, second], routes), routes);
  assert.equal(new Set(Object.values(routes)).size, 2);
  assert.throws(() => assignSlugs([first], { [first.id]: "../escape" }));
  assert.throws(() => assignSlugs([first], { [first.id]: "ayni", [second.id]: "ayni" }));
});

test("Eski bağlantı yeni adrese gider; bölüm ve sorgu korunur, yerelde dosya açılır", () => {
  const { document } = parseHTML(renderRedirect(first));
  const script = document.querySelector("script").textContent;
  for (const protocol of ["https:", "file:"]) {
    const href = protocol === "file:"
      ? `file:///C:/blog/blog-files/yazilar/${first.id}/index.html?x=1#bolum-2`
      : `https://hcengiz.com/blog/blog-files/yazilar/${first.id}/index.html?x=1#bolum-2`;
    const source = new URL(href);
    let result;
    runInNewContext(script, { URL, location: { href, protocol, search: source.search, hash: source.hash, replace: target => { result = target; } } });
    const target = new URL(result);
    assert.equal(target.pathname, `${protocol === "file:" ? "/C:/blog/" : "/blog/"}${articlePath(first)}${protocol === "file:" ? "index.html" : ""}`);
    assert.equal(target.hash, "#bolum-2");
    assert.equal(target.search, "?x=1");
  }
  assert.equal(document.querySelector('link[rel="canonical"]').href, `https://hcengiz.com/blog/${articlePath(first)}`);
});
