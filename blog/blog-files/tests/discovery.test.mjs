import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import { BLOG_ROOT } from "../scripts/lib/content.mjs";
import { articlePath } from "../scripts/lib/routes.mjs";
import { parseSeriesTitle, buildSeriesIndex, createRelatedSelector } from "../scripts/lib/discovery.mjs";
import { renderArticle } from "../scripts/build-articles.mjs";

const template = await readFile(resolve(BLOG_ROOT, "index.html"), "utf8");
function article(number, title, content = "", categories = []) {
  const id = number.toString(16).padStart(12, "0");
  return { id, title, content, categories, pubDate: "2026-01-01T00:00:00Z", link: `https://medium.com/p/${id}`, thumbnail: "", fullContent: true };
}
const chapters = Array.from({ length: 11 }, (_, index) => article(index + 1, `React Serisi — #${String(index + 1).padStart(2, "0")} Konu ${index + 1}`, "<p>React bileşenleri</p>"));

test("Seri başlıkları numarayla eşleşir; sıradan numaralı makaleler seriye dönüşmez", () => {
  const parsed = parseSeriesTitle("React Serisi — #03 React Hook’larına Derin Dalış");
  assert.equal(parsed.key, "react-serisi");
  assert.equal(parsed.part, 3);
  assert.equal(parsed.chapterTitle, "React Hook’larına Derin Dalış");
  assert.equal(parseSeriesTitle("REACT SERİSİ: #12 Yeni bölüm").key, parsed.key);
  assert.equal(parseSeriesTitle(".Net Core Serisi – #01 Giriş").part, 1);
  assert.equal(parseSeriesTitle("React Serisi #00 Taslak"), null);
  assert.equal(parseSeriesTitle("React için 20 ipucu"), null);
});

test("Bölümler sayısal sıralanır; yeni bölüm eklenince eski sayfaların sayacı ve komşuları güncellenir", () => {
  const index = buildSeriesIndex([...chapters].reverse());
  const third = index.get(chapters[2].id);
  assert.equal(third.position, 3);
  assert.equal(third.total, 11);
  assert.equal(third.previous.id, chapters[1].id);
  assert.equal(third.next.id, chapters[3].id);
  assert.equal(index.get(chapters[0].id).previous, null);
  assert.equal(index.get(chapters[10].id).next, null);
  const next = article(12, "React Serisi — #12 Yeni bölüm");
  const updated = buildSeriesIndex([...chapters, next]);
  assert.equal(updated.get(chapters[2].id).total, 12);
  assert.equal(updated.get(chapters[10].id).next.id, next.id);
  const gap = buildSeriesIndex([chapters[0], chapters[2]]).get(chapters[2].id);
  assert.equal(gap.continuous, false);
  assert.equal(gap.previous.id, chapters[0].id);
  assert.equal(gap.next, null);
});

test("Seri bölümleri ve önceki/sonraki bağlantıları erişilebilir, uzantısız adreslerle üretilir", () => {
  const current = chapters[2];
  const { document } = parseHTML(renderArticle(current, template, [], buildSeriesIndex(chapters).get(current.id)));
  assert.equal(document.querySelector(".series-position").textContent, "3/11");
  assert.equal(document.querySelectorAll(".series-chapters a").length, 11);
  assert.equal(document.querySelector('.series-chapters [aria-current="page"]').getAttribute("href"), `../../${articlePath(current)}`);
  assert.equal(document.querySelector(".series-previous").getAttribute("href"), `../../${articlePath(chapters[1])}`);
  assert.equal(document.querySelector(".series-next").getAttribute("href"), `../../${articlePath(chapters[3])}`);
  assert.equal(document.querySelector(".reader-series").hasAttribute("open"), false);
  const standalone = parseHTML(renderArticle(article(20, "Bağımsız makale"), template)).document;
  assert.equal(standalone.querySelector(".reader-series"), null);
  assert.equal(standalone.querySelector(".reader-series-nav"), null);
});

test("Öneriler tarih yerine başlık, kategori ve içerik yakınlığıyla seçilir; kod örnekleri yanıltmaz", () => {
  const current = article(30, "React Hook ve state yönetimi", "<p>React state effect component</p>", ["react"]);
  const related = article(31, "React bileşenlerinde effect", "<p>Hook state component davranışı</p>");
  const fromBody = article(32, "Durumu doğru yönetmek", "<p>React hook effect state component bileşenleri</p>");
  const newest = { ...article(33, "Bahçede çiçek yetiştirmek", "<p>Toprak çiçek bahçe sulama</p><pre>React hook state effect component</pre>"), pubDate: "2026-11-08T00:00:00Z" };
  const select = createRelatedSelector([current, related, fromBody, newest, current]);
  const recommendations = select(current);
  assert.deepEqual(new Set(recommendations.map(post => post.id)), new Set([related.id, fromBody.id]));
  assert.equal(select(current, 1).length, 1);
  const unrelated = article(34, "Deniz yolculuğu", "<p>Yelken liman dalga</p>");
  assert.deepEqual(createRelatedSelector([current, unrelated])(current), []);
});
