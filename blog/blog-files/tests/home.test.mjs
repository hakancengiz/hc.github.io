import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { BLOG_ROOT, FILES_ROOT } from "../scripts/lib/content.mjs";
import { embedIndexData } from "../scripts/build-articles.mjs";
import { parseSeriesTitle } from "../scripts/lib/discovery.mjs";

const html = await readFile(resolve(BLOG_ROOT, "index.html"), "utf8");
const script = await readFile(resolve(FILES_ROOT, "app.js"), "utf8");
const data = JSON.parse(await readFile(resolve(FILES_ROOT, "data/posts.json"), "utf8"));

async function loadHome(protocol, source = html, fetcher = async () => { throw new Error("Failed to fetch"); }, { autoLoading = true, reducedMotion = false } = {}) {
  const { document } = parseHTML(source);
  const memory = new Map();
  let requests = 0;
  let observer;
  let revealObserver;
  class MockIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback; this.options = options; this.targets = new Set();
      if (options.rootMargin.includes("480px")) observer = this;
      else revealObserver = this;
    }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  runInNewContext(script, {
    document, URL, Intl, AbortSignal,
    window: { location: new URL(protocol === "file:" ? "file:///C:/blog/index.html" : "https://example.com/blog/"), IntersectionObserver: autoLoading ? MockIntersectionObserver : undefined, matchMedia: () => ({ matches: reducedMotion }) },
    localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
    fetch: async (...args) => { requests++; return fetcher(...args); }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { document, requests, observer, revealObserver,
    nearEnd(isIntersecting = true) {
      const target = document.getElementById("feed-sentinel");
      if (observer?.targets.has(target)) observer.callback([{ target, isIntersecting }]);
    }
  };
}

test("HTML dosyası doğrudan açıldığında ve her yenilemede gömülü arşiv gösterilir", async () => {
  const source = embedIndexData(html, data);
  for (let refresh = 0; refresh < 2; refresh++) {
    const { document, requests } = await loadHome("file:", source);
    assert.equal(document.getElementById("error-state").hidden, true);
    assert.equal(document.querySelectorAll(".article-card").length, 6);
    assert.equal(document.querySelector(".spotlight-title").textContent, data.items[0].title);
    assert.equal(requests, 0);
    assert.ok(document.querySelector(".spotlight-card").getAttribute("href").endsWith("/index.html"));
    assert.equal(document.querySelector(".brand").getAttribute("href"), "index.html");
  }
});

test("HTTP sayfası gömülü listeyle ağ isteği olmadan açılır; gömülü veri yoksa JSON kullanılır", async () => {
  const embedded = await loadHome("https:", embedIndexData(html, data));
  assert.equal(embedded.requests, 0);
  assert.equal(embedded.document.getElementById("error-state").hidden, true);
  assert.equal(embedded.document.querySelector(".spotlight-card").getAttribute("href"), data.items[0].localUrl);
  assert.equal(embedded.document.querySelector(".brand").getAttribute("href"), "./");
  const withoutSnapshot = html.replace(/<script\b[^>]*id="posts-data"[^>]*>[\s\S]*?<\/script>/, "");
  const fallback = await loadHome("https:", withoutSnapshot, async () => ({ ok: true, json: async () => data }));
  assert.equal(fallback.requests, 1);
  assert.equal(fallback.document.getElementById("error-state").hidden, true);
});

test("Gömülü JSON içindeki HTML karakterleri script etiketini kapatamaz", () => {
  const content = { version: 1, items: [{ title: '</script><script id="injected">alert(1)</script>' }] };
  const result = embedIndexData(embedIndexData(html, content), content);
  const { document } = parseHTML(result);
  assert.equal(document.querySelectorAll("#posts-data").length, 1);
  assert.equal(document.getElementById("injected"), null);
  assert.deepEqual(JSON.parse(document.getElementById("posts-data").textContent), content);
});

test("Makale bağlantısı yalnızca geçerli yerel adrese gider", async () => {
  for (const localUrl of ["https://example.org/", "../escape/", "yazi/../../escape/", "javascript:alert(1)"]) {
    const item = { ...data.items[0], localUrl };
    const { document } = await loadHome("https:", embedIndexData(html, { ...data, items: [item] }));
    assert.equal(document.querySelector(".spotlight-card").getAttribute("href"), `blog-files/yazilar/${item.id}/`);
  }
});

test("Liste sonuna yaklaşınca yazılar altışarlı eklenir; mevcut kartlar korunur ve sonunda durur", async () => {
  const page = await loadHome("https:");
  const feed = page.document.getElementById("feed");
  const firstCard = feed.firstElementChild;
  const sentinel = page.document.getElementById("feed-sentinel");
  assert.equal(page.document.getElementById("load-more"), null);
  assert.equal(feed.children.length, 6);
  page.nearEnd(false);
  assert.equal(feed.children.length, 6);
  page.nearEnd();
  assert.equal(feed.children.length, 12);
  assert.equal(feed.firstElementChild, firstCard);
  for (let i = 0; i < data.items.length; i++) page.nearEnd();
  assert.equal(feed.children.length, data.items.length - 1);
  assert.equal(new Set([...feed.children].map(card => card.getAttribute("href"))).size, data.items.length - 1);
  assert.equal(sentinel.hidden, true);
  assert.equal(page.observer.targets.size, 0);
  assert.equal(page.requests, 0);
});

test("Arama ve kategori değişince otomatik liste sıfırlanır; boş sonuçta yükleme durur", async () => {
  const page = await loadHome("https:");
  const { document } = page;
  const feed = document.getElementById("feed");
  const search = document.getElementById("search");
  page.nearEnd();
  search.value = "React Serisi";
  search.dispatchEvent(new document.defaultView.Event("input"));
  assert.equal(feed.children.length, 6);
  assert.equal(document.getElementById("spotlight-section").hidden, true);
  page.nearEnd();
  assert.equal(feed.children.length, 11);
  assert.ok([...feed.querySelectorAll(".article-title")].every(title => title.textContent.startsWith("React Serisi")));
  search.value = "eşleşmeyen-bir-arama-xyz";
  search.dispatchEvent(new document.defaultView.Event("input"));
  assert.equal(feed.children.length, 0);
  assert.equal(document.getElementById("feed-sentinel").hidden, true);
  assert.equal(document.getElementById("empty-state").hidden, false);
  document.getElementById("reset-filters").click();
  assert.equal(feed.children.length, 6);
  assert.equal(document.getElementById("spotlight-section").hidden, false);
  document.querySelector('button[data-category="csharp"]').dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));
  for (let i = 0; i < data.items.length; i++) page.nearEnd();
  const matching = data.items.filter(item => item.categories.includes("csharp"));
  assert.equal(feed.children.length, matching.length);
  assert.ok([...feed.children].every(card => matching.some(item => item.localUrl === card.getAttribute("href"))));
});

test("Otomatik yükleme desteklenmezse tüm yazılara erişilebilir", async () => {
  const page = await loadHome("https:", html, undefined, { autoLoading: false });
  assert.equal(page.document.querySelectorAll(".article-card").length, data.items.length - 1);
  assert.equal(page.document.getElementById("feed-sentinel").hidden, true);
});

test("Yeni kartlar görünürken bir kez belirir; arama gözlemi temizler ve azaltılmış harekette animasyon eklenmez", async () => {
  const page = await loadHome("https:");
  const feed = page.document.getElementById("feed");
  page.nearEnd();
  const card = feed.children[6];
  assert.equal(page.revealObserver.targets.size, 6);
  assert.equal(card.classList.contains("is-entering"), false);
  page.revealObserver.callback([{ target: card, isIntersecting: true }]);
  assert.equal(card.classList.contains("is-entering"), true);
  assert.equal(feed.children[0].classList.contains("is-entering"), false);
  assert.equal(page.revealObserver.targets.has(card), false);
  card.dispatchEvent(new page.document.defaultView.Event("animationend"));
  assert.equal(card.classList.contains("is-entering"), false);
  const search = page.document.getElementById("search");
  search.value = "React Serisi";
  search.dispatchEvent(new page.document.defaultView.Event("input"));
  assert.equal(page.revealObserver.targets.size, 0);
  const reduced = await loadHome("https:", html, undefined, { reducedMotion: true });
  reduced.nearEnd();
  assert.equal(reduced.document.querySelectorAll(".article-card").length, 12);
  assert.equal(reduced.revealObserver, undefined);
  assert.equal(reduced.document.querySelectorAll(".is-entering").length, 0);
});

test("Seri filtreleri bütün bölümleri numara sırasıyla gösterir; Tümü ve konu filtreleri seriden çıkar", async () => {
  const page = await loadHome("https:");
  const { document } = page;
  const click = selector => document.querySelector(selector).dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));
  const feed = document.getElementById("feed");
  for (const [key, count] of [["react-serisi", 11], ["net-core-serisi", 10]]) {
    const button = document.querySelector(`button[data-series="${key}"]`);
    assert.equal(button.querySelector(".filter-count").textContent, String(count));
    click(`button[data-series="${key}"]`);
    assert.equal(document.getElementById("spotlight-section").hidden, true);
    assert.equal(feed.children.length, 6);
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(document.querySelectorAll('#filters [aria-pressed="true"]').length, 1);
    page.nearEnd();
    const expected = data.items.filter(item => item.series?.key === key).sort((a, b) => a.series.part - b.series.part);
    assert.equal(feed.children.length, count);
    assert.deepEqual([...feed.children].map(card => card.getAttribute("href")), expected.map(item => item.localUrl));
    assert.equal(document.getElementById("feed-sentinel").hidden, true);
  }
  click('button[data-category="all"]');
  assert.equal(document.getElementById("spotlight-section").hidden, false);
  assert.equal(feed.children.length, 6);
  click('button[data-series="react-serisi"]');
  click('button[data-category="csharp"]');
  assert.equal(document.querySelector('button[data-series="react-serisi"]').getAttribute("aria-pressed"), "false");
  assert.equal(feed.children.length, Math.min(6, data.items.filter(item => item.categories.includes("csharp")).length));
});

test("Yeni bölüm ve yeni seri otomatik filtreye girer; arama seçili seri içinde çalışır ve sıfırlanabilir", async () => {
  const nextTitle = "React Serisi — #12 Yeni bölüm";
  const next = { ...data.items[0], id: "aaaaaaaaaaaa", title: nextTitle, link: "https://medium.com/p/aaaaaaaaaaaa", localUrl: "yazi/react-serisi-12-yeni-bolum/", series: parseSeriesTitle(nextTitle) };
  const otherTitle = "Python Serisi — #01 Başlangıç";
  const other = { ...next, id: "bbbbbbbbbbbb", title: otherTitle, link: "https://medium.com/p/bbbbbbbbbbbb", localUrl: "yazi/python-serisi-01-baslangic/", series: parseSeriesTitle(otherTitle) };
  const page = await loadHome("https:", embedIndexData(html, { ...data, items: [...data.items, next, other] }));
  const { document } = page;
  const button = document.querySelector('button[data-series="react-serisi"]');
  assert.equal(button.querySelector(".filter-count").textContent, "12");
  assert.equal(document.querySelector('button[data-series="python-serisi"] .filter-count').textContent, "1");
  button.dispatchEvent(new document.defaultView.Event("click", { bubbles: true }));
  page.nearEnd();
  assert.equal(document.getElementById("feed").children.length, 12);
  assert.equal(document.getElementById("feed").lastElementChild.getAttribute("href"), next.localUrl);
  const search = document.getElementById("search");
  search.value = "TypeScript";
  search.dispatchEvent(new document.defaultView.Event("input"));
  assert.ok(document.getElementById("feed").children.length > 0);
  assert.ok([...document.querySelectorAll(".article-title")].every(title => title.textContent.startsWith("React Serisi")));
  assert.equal(button.getAttribute("aria-pressed"), "true");
  search.value = "eşleşmeyen-seri-arama-xyz";
  search.dispatchEvent(new document.defaultView.Event("input"));
  assert.equal(document.getElementById("empty-state").hidden, false);
  document.getElementById("reset-filters").click();
  assert.equal(document.getElementById("spotlight-section").hidden, false);
  assert.equal(document.querySelector('button[data-category="all"]').getAttribute("aria-pressed"), "true");
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("Filtrelerde dokunma hareketi iptal edilmez; kaydırma filtre seçmez ve sonraki dokunuş seçebilir", async () => {
  const page = await loadHome("https:");
  const { document } = page;
  const button = document.querySelector('button[data-series="react-serisi"]');
  const target = button.querySelector("span");
  // These synthetic events check application handlers, not native browser gesture physics.
  for (const type of ["pointerdown", "touchstart", "pointermove", "touchmove", "pointercancel", "touchend"]) {
    const event = new document.defaultView.Event(type, { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, type);
  }
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(document.getElementById("spotlight-section").hidden, false);
  const tap = new document.defaultView.Event("click", { bubbles: true, cancelable: true });
  target.dispatchEvent(tap);
  assert.equal(tap.defaultPrevented, false);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(document.getElementById("spotlight-section").hidden, true);
  assert.ok([...document.querySelectorAll(".article-title")].every(title => title.textContent.startsWith("React Serisi")));
});
