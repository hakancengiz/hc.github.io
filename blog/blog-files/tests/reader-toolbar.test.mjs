import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { BLOG_ROOT, FILES_ROOT } from "../scripts/lib/content.mjs";
import { renderArticle } from "../scripts/build-articles.mjs";
import { buildSeriesIndex } from "../scripts/lib/discovery.mjs";

const template = await readFile(resolve(BLOG_ROOT, "index.html"), "utf8");
const script = await readFile(resolve(FILES_ROOT, "reader.js"), "utf8");
const post = { id: "abcdef123456", title: "Makale", pubDate: "2026-11-07T10:00:00Z", link: "https://medium.com/p/abcdef123456", content: "<p>Makale metni</p>", categories: [], thumbnail: "", fullContent: true };

function reader({ top = 140, mobile = true, withToc = false, withSeries = false, withScrollableContent = false, protocol = "https:" } = {}) {
  let content = withToc ? "<h2>Birinci bölüm</h2><p>İlk bölüm</p><h2>İkinci bölüm</h2><p>Son bölüm</p>" : post.content;
  if (withScrollableContent) content += '<pre>const longExample = "Kaydırılabilen bir kod örneği";</pre><table><tr><td>Kaydırılabilen tablo</td></tr></table>';
  const current = { ...post, content, title: withSeries ? "React Serisi — #02 Konu" : post.title };
  const seriesPosts = [
    { ...post, id: "111111111111", title: "React Serisi — #01 Giriş" }, current,
    { ...post, id: "333333333333", title: "React Serisi — #03 İleri" },
  ];
  const { document } = parseHTML(renderArticle(current, template, [], withSeries ? buildSeriesIndex(seriesPosts).get(current.id) : null));
  const listeners = new Map();
  let mediaChange;
  const media = { matches: mobile, addEventListener(type, callback) { mediaChange = callback; } };
  const window = { location: new URL(protocol === "file:" ? "file:///C:/blog/yazi/react-serisi-02-konu/index.html" : "https://example.com/blog/yazilar/abcdef123456/"), innerWidth: mobile ? 390 : 1200, innerHeight: 800, scrollY: 0, matchMedia: () => media, addEventListener(type, callback) { listeners.set(type, callback); } };
  const anchor = document.getElementById("reader-toolbar-anchor");
  anchor.getBoundingClientRect = () => ({ top });
  const toolbar = document.getElementById("reader-toolbar");
  Object.defineProperty(toolbar, "offsetHeight", { value: 40 });
  const button = document.getElementById("theme-button");
  Object.defineProperty(button, "offsetWidth", { value: 28 });
  Object.defineProperty(button, "offsetHeight", { value: 32 });
  const home = button.parentElement;
  const article = document.querySelector(".prose");
  article.getBoundingClientRect = () => ({ top: 300 });
  Object.defineProperty(article, "offsetHeight", { value: 1600 });
  const saved = new Map();
  runInNewContext(script, { document, window, URL, navigator: {}, localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }, requestAnimationFrame: callback => callback(), setTimeout, clearTimeout });
  return { document, button, home, toolbar, anchor, saved,
    scrollTo(value) { top = value; window.scrollY = 140 - top; listeners.get("scroll")(); },
    resize(mobile) { media.matches = mobile; window.innerWidth = mobile ? 390 : 1200; mediaChange(); listeners.get("resize")(); }
  };
}

test("Mobil çubuk eşikte sabitlenir; aynı tema düğmesi taşınır ve yukarı dönünce geri gelir", () => {
  const page = reader();
  assert.equal(page.toolbar.classList.contains("is-stuck"), false);
  assert.equal(page.button.parentElement, page.home);
  page.scrollTo(-20);
  assert.equal(page.toolbar.classList.contains("is-stuck"), true);
  assert.equal(page.button.parentElement.id, "reader-toolbar-theme");
  assert.equal(page.document.querySelectorAll("#theme-button").length, 1);
  assert.equal(page.anchor.style.minHeight, "40px");
  assert.equal(page.home.querySelector(".reader-theme-placeholder").hidden, false);
  page.button.click();
  assert.equal(page.document.documentElement.dataset.theme, "light");
  assert.equal(page.saved.get("theme"), "light");
  page.scrollTo(25);
  assert.equal(page.toolbar.classList.contains("is-stuck"), false);
  assert.equal(page.button.parentElement, page.home);
  assert.equal(page.home.querySelector(".reader-theme-placeholder").hidden, true);
  assert.equal(page.anchor.style.minHeight, "");
  assert.equal(page.button.getAttribute("aria-pressed"), "false");
});

test("Derin bağlantıda çubuk açılır; masaüstüne geçince düğme eski yerine döner", () => {
  const page = reader({ top: -100 });
  assert.equal(page.toolbar.classList.contains("is-stuck"), true);
  page.resize(false);
  assert.equal(page.toolbar.classList.contains("is-stuck"), false);
  assert.equal(page.button.parentElement, page.home);
  page.scrollTo(-300);
  assert.equal(page.toolbar.classList.contains("is-stuck"), false);
  page.resize(true);
  assert.equal(page.toolbar.classList.contains("is-stuck"), true);
  const author = page.document.querySelector(".reader-source .reader-author");
  assert.equal(author.querySelector("img").getAttribute("src"), "../../blog-files/img/profile-site.webp");
  assert.ok(author.textContent.includes("Hakan Cengiz"));
});

test("Mobil içindekiler aynı çubuktan açılır; bölüm seçilince kapanır ve sabit çubukta da çalışır", () => {
  const page = reader({ withToc: true });
  const toggle = page.document.getElementById("reader-toc-toggle");
  const panel = page.document.getElementById("reader-toc-panel");
  assert.equal(toggle.parentElement, page.toolbar);
  assert.equal(panel.parentElement, page.toolbar);
  assert.equal(toggle.getAttribute("aria-controls"), panel.id);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(panel.hasAttribute("inert"), true);
  toggle.click();
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(panel.classList.contains("is-open"), true);
  assert.equal(panel.hasAttribute("inert"), false);
  panel.querySelectorAll("a")[1].click();
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(panel.classList.contains("is-open"), false);
  assert.equal(panel.hasAttribute("inert"), true);
  assert.equal(panel.querySelectorAll("[aria-current]").length, 1);
  page.scrollTo(-20);
  toggle.click();
  assert.equal(page.toolbar.classList.contains("is-stuck"), true);
  assert.equal(panel.parentElement, page.toolbar);
  assert.equal(panel.classList.contains("is-open"), true);
  toggle.click();
  assert.equal(panel.classList.contains("is-open"), false);
});

test("Masaüstünde içindekiler sol sütuna döner; kapalı masaüstü tercihi korunur", () => {
  const page = reader({ mobile: false, withToc: true });
  const panel = page.document.getElementById("reader-toc-panel");
  const details = panel.querySelector("details");
  const toggle = page.document.getElementById("reader-toc-toggle");
  assert.equal(panel.parentElement.classList.contains("reader-layout"), true);
  details.removeAttribute("open");
  page.resize(true);
  assert.equal(panel.parentElement, page.toolbar);
  assert.equal(details.hasAttribute("open"), true);
  toggle.click();
  page.resize(false);
  assert.equal(panel.parentElement.classList.contains("reader-layout"), true);
  assert.equal(panel.hasAttribute("inert"), false);
  assert.equal(details.hasAttribute("open"), false);
  assert.equal(page.toolbar.classList.contains("has-mobile-toc"), false);
  page.resize(true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(panel.hasAttribute("inert"), true);
});

test("Seri bağlantıları webde klasörü, doğrudan dosya önizlemesinde index.html dosyasını açar", () => {
  for (const protocol of ["https:", "file:"]) {
    const page = reader({ withSeries: true, protocol });
    for (const link of page.document.querySelectorAll("a[data-article-link]")) {
      assert.equal(link.getAttribute("href").endsWith("index.html"), protocol === "file:");
    }
  }
});

test("Mobil içindekiler, seri, kod ve tabloda dokunma engellenmez; bölüm bağlantıları tıklanabilir kalır", () => {
  const page = reader({ withToc: true, withSeries: true, withScrollableContent: true });
  const { document } = page;
  const toggle = document.getElementById("reader-toc-toggle");
  toggle.click();
  document.querySelector(".reader-series").setAttribute("open", "");
  for (const selector of ["body", ".reader-toc nav", ".series-chapters", ".prose pre", ".prose table"]) {
    const area = document.querySelector(selector);
    assert.ok(area, selector);
    const target = area.querySelector("a,code,td") || area;
    for (const type of ["pointerdown", "touchstart", "pointermove", "touchmove", "pointercancel", "touchend"]) {
      const event = new document.defaultView.Event(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, `${selector}: ${type}`);
    }
  }
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  const tocLink = document.querySelectorAll(".reader-toc a")[1];
  const tap = new document.defaultView.Event("click", { bubbles: true, cancelable: true });
  tocLink.dispatchEvent(tap);
  assert.equal(tap.defaultPrevented, false);
  assert.equal(tocLink.getAttribute("aria-current"), "location");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  const seriesTap = new document.defaultView.Event("click", { bubbles: true, cancelable: true });
  document.querySelector(".series-chapters a").dispatchEvent(seriesTap);
  assert.equal(seriesTap.defaultPrevented, false);
});
