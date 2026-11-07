import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";

const html = await readFile(new URL("../../rsskontrol.html", import.meta.url), "utf8");
const script = await readFile(new URL("../rss-kontrol.js", import.meta.url), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));

function openCheck(fetcher) {
  const { document } = parseHTML(html);
  const requests = [];
  const listeners = new Map();
  runInNewContext(script, {
    document, URL, crypto, AbortSignal,
    window: { addEventListener: (name, callback) => listeners.set(name, callback) },
    fetch: (...args) => { requests.push(args); return fetcher(...args); },
  });
  return { document, requests, listeners, output: document.getElementById("latest-article") };
}

const response = items => ({ ok: true, json: async () => ({ status: "ok", items }) });
const article = (title, pubDate = "2026-11-08 10:00:00") => ({ title, pubDate });

test("Her açılış RSS kaynağını benzersiz URL ile sorgular; en yeni başlık güvenle gösterilir", async () => {
  const addresses = [];
  for (let visit = 0; visit < 2; visit++) {
    const title = `Yeni yazı ${visit} <script>alert(1)</script> & C#`;
    const page = openCheck(async () => response([
      article("Eski yazı", "2026-01-01 10:00:00"),
      article("Geçersiz tarih", "yanlış"),
      article(title),
    ]));
    assert.equal(page.output.textContent, "RSS kontrol ediliyor…");
    assert.equal(page.output.getAttribute("aria-busy"), "true");
    await settle();
    assert.equal(page.output.textContent, title);
    assert.equal(page.output.children.length, 0);
    assert.equal(page.output.getAttribute("aria-busy"), "false");
    assert.equal(page.requests.length, 1);
    const [address, options] = page.requests[0];
    const endpoint = new URL(address);
    const source = new URL(endpoint.searchParams.get("rss_url"));
    assert.equal(endpoint.origin, "https://api.rss2json.com");
    assert.equal(source.origin + source.pathname, "https://medium.com/feed/@hakancengiz");
    assert.ok(source.searchParams.get("rsskontrol"));
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    addresses.push(source.href);
  }
  assert.notEqual(addresses[0], addresses[1]);
  assert.ok(!html.includes("Mülakatlarda"));
  assert.ok(html.includes("background:#fff"));
  assert.equal(parseHTML(html).document.querySelector('meta[name="robots"]').content, "noindex,nofollow");
});

test("Ağ hatası, zaman aşımı, HTTP hatası veya bozuk/boş akış eski başlığı göstermez", async () => {
  for (const fetcher of [
    async () => { throw new TypeError("Network error"); },
    async () => { throw new DOMException("Timeout", "TimeoutError"); },
    async () => ({ ok: false, status: 429 }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }),
    async () => ({ ok: true, json: async () => ({ status: "error", items: [article("Eski")] }) }),
    async () => response([]),
    async () => response([article("", "2026-01-01"), article("Başlık", "geçersiz")]),
  ]) {
    const page = openCheck(fetcher);
    await settle();
    assert.ok(page.output.textContent.startsWith("RSS şu an kontrol edilemiyor."));
    assert.equal(page.requests.length, 1);
    assert.equal(page.output.getAttribute("aria-busy"), "false");
  }
});

test("Geri dönüş önbelleğinden açılışta da yenilenir; eski istek yeni sonucu ezmez", async () => {
  let finishFirst;
  const page = openCheck(() => new Promise(resolve => { finishFirst = resolve; }));
  page.listeners.get("pageshow")({ persisted: false });
  assert.equal(page.requests.length, 1);
  const finishOld = finishFirst;
  page.listeners.get("pageshow")({ persisted: true });
  assert.equal(page.requests.length, 2);
  finishFirst(response([article("Yeni kontrol")]));
  await settle();
  assert.equal(page.output.textContent, "Yeni kontrol");
  finishOld(response([article("Eski kontrol")]));
  await settle();
  assert.equal(page.output.textContent, "Yeni kontrol");
});
