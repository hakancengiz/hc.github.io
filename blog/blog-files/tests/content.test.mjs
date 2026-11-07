import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { spawnSync } from "node:child_process";
import { parseHTML } from "linkedom";
import {
  BLOG_ROOT,
  FILES_ROOT,
  normalizePost,
  cleanContent,
  mergePosts,
  parseFeed,
  parseExport,
  savePosts,
  readArchive,
  textFromHtml,
} from "../scripts/lib/content.mjs";
import { renderArticle, build, articleBody } from "../scripts/build-articles.mjs";

const id = "abcdef123456";
const raw = {
  title: "Türkçe &amp; C#",
  link: `https://medium.com/@hakancengiz/test-${id}?source=rss`,
  pubDate: "2026-11-07 10:00:00",
  categories: ["csharp"],
  content:
    '<figure><img src="https://example.com/cover.png"></figure><h3>Bir başlık</h3><p>Bir paragraf.</p><pre>if (a &lt; b) return a;</pre><h3>Sonuç</h3><p>Son paragraf.</p><img src="https://medium.com/_/stat?referrerSource=full_rss" width="1" height="1">',
};
const post = normalizePost(raw);
const exportHtml = `<html><body><article class="h-entry"><header><h1 class="p-name">Eski yazı</h1></header><section class="e-content"><h3>Başlık</h3><p>Gövde</p></section><footer><time class="dt-published" datetime="2025-01-02T10:00:00Z"></time><a class="p-canonical" href="https://medium.com/p/${id}"></a></footer></article></body></html>`;

test("RSS içeriği, kimlik, tarih ve kod korunur; takip pikseli kaldırılır", () => {
  assert.equal(post.id, id);
  assert.equal(post.title, "Türkçe & C#");
  assert.equal(post.pubDate, "2026-11-07T10:00:00.000Z");
  assert.equal(post.fullContent, true);
  assert.ok(post.content.includes("a &lt; b"));
  assert.ok(!post.content.includes("/_/stat"));
  assert.equal(
    textFromHtml("<h3>Başlık</h3><p>Paragraf</p>"),
    "Başlık Paragraf",
  );
});

test("Kod renklendirmesi C# sözdizimini ve RSS satır sonlarını korur", () => {
  const result = articleBody({ ...post, content: '<pre><code class="language-csharp">string text = "Merhaba";<br>if (text.Length &gt; 0) Console.WriteLine(text);</code></pre>' });
  const { document } = parseHTML(`<html><body>${result.html}</body></html>`);
  const code = document.querySelector("pre code");
  assert.equal(code.textContent, 'string text = "Merhaba";\nif (text.Length > 0) Console.WriteLine(text);');
  assert.ok(code.querySelector(".hljs-keyword"));
  assert.ok(code.querySelector(".hljs-string"));
  assert.ok(code.classList.contains("language-csharp"));
});

test("HTML örneği kod olarak kalır ve renklendirme sırasında çalıştırılabilir öğeye dönüşmez", () => {
  const source = '<img src="x" onerror="alert(1)">\n<script>alert(2)</script>';
  const escaped = source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const result = articleBody({ ...post, content: `<pre><code class="language-html">${escaped}</code></pre>` });
  const { document } = parseHTML(`<html><body>${result.html}</body></html>`);
  assert.equal(document.querySelector("code").textContent, source);
  assert.equal(document.querySelectorAll("img,script,[onerror]").length, 0);
  assert.ok(document.querySelector(".hljs-tag"));
});

test("RSS'te düz gelen teknik tanımlar etiketlenir; normal Türkçe var sözcüğü ve metin korunur", () => {
  const source = '<h4>var nedir?</h4><p>var, değişken tipini belirler.</p><p>Burada başka bir durum var.</p><h4>dynamic nedir?</h4><p>dynamic, çalışma zamanında belirlenir.</p><h4>StringBuilder nedir?</h4><p>StringBuilder, metin oluşturur.</p><h4>object nedir?</h4>';
  const result = articleBody({ ...post, content: source });
  const { document } = parseHTML(`<html><body>${result.html}</body></html>`);
  assert.deepEqual([...document.querySelectorAll('p code')].map(code => code.textContent), ['var', 'dynamic', 'StringBuilder']);
  assert.equal(document.querySelectorAll('p')[1].querySelector('code'), null);
  assert.equal(document.body.textContent, parseHTML(`<html><body>${source}</body></html>`).document.body.textContent);
});

test("HTML içindeki aktif kod, tehlikeli URL ve olay öznitelikleri temizlenir", () => {
  const result = cleanContent(
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><svg onload="alert(1)"></svg><p style="color:red" onclick="x()">Metin</p><iframe src="https://example.com/embed"></iframe>',
    raw.link,
  );
  assert.ok(
    !/script|javascript:|onerror|onclick|onload|style=|<svg|<iframe/i.test(
      result,
    ),
  );
  assert.ok(result.includes("Gömülü içeriği aç"));
  assert.equal(
    normalizePost({ ...raw, link: "https://evil.example/test-abcdef123456" }),
    null,
  );
  assert.equal(normalizePost({ ...raw, pubDate: "invalid" }), null);
});

test("Akıştan çıkan yazılar tutulur; kısmi RSS içeriği tam metni ezmez", () => {
  const old = {
    ...post,
    id: "111111111111",
    pubDate: "2025-01-01T00:00:00.000Z",
  };
  const partial = {
    ...post,
    content: "<p>Özet</p>",
    fullContent: false,
    categories: [],
  };
  const merged = mergePosts([post, old], [partial]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].content, post.content);
  assert.deepEqual(merged[0].categories, ["csharp"]);
  assert.equal(mergePosts(merged, [post]).length, 2);
});

test("Arşivin zengin tam metni RSS ile bozulmaz; yeni export içeriği güncelleyebilir", () => {
  const exported = { ...post, source: "export", content: "<p><code>var</code> tam metin</p>", fullContent: true };
  const rss = { ...post, source: "rss", content: "<p>var tam metin</p>", categories: ["dotnet"] };
  const merged = mergePosts([exported], [rss])[0];
  assert.equal(merged.content, exported.content);
  assert.equal(merged.source, "export");
  assert.deepEqual(merged.categories, ["dotnet"]);
  const updated = { ...exported, content: "<p>Yeni tam metin</p>" };
  assert.equal(mergePosts([merged], [updated])[0].content, updated.content);
});

test("XML kategori listesi ve tek makale okunur; bozuk XML ve DTD reddedilir", () => {
  const xml = `<rss><channel><item><title><![CDATA[${raw.title}]]></title><link>${raw.link.replace("?source=rss", "")}</link><pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate><category>csharp</category><category>api</category><content:encoded><![CDATA[${raw.content}]]></content:encoded></item></channel></rss>`;
  const posts = parseFeed(xml);
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].categories, ["csharp", "api"]);
  assert.throws(() => parseFeed("<rss>"));
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY e "bad">]><rss/>'));
});

test("Export yalnızca yayımlanma bilgisi olan makaleleri kabul eder", () => {
  assert.equal(parseExport(exportHtml, "posts/published.html").id, id);
  assert.equal(parseExport(exportHtml, "posts/draft_Test.html"), null);
  assert.equal(
    parseExport(
      exportHtml.replace('class="dt-published"', 'class="dt-created"'),
    ),
    null,
  );
  assert.equal(
    parseExport("<html><body>Özel hesap verisi</body></html>"),
    null,
  );
});

test("Export gövdesindeki yinelenen başlık kaldırılır; satır içi kod ve kod satırları korunur", () => {
  const source = exportHtml.replace('<h3>Başlık</h3><p>Gövde</p>', '<h3 class="graf--title">Eski yazı</h3><h3>Başlık</h3><p><code>var</code> tanımı</p><pre>bir<br>iki</pre>');
  const parsed = parseExport(source);
  const { document } = parseHTML(`<body>${parsed.content}</body>`);
  assert.equal(document.querySelectorAll("h3").length, 1);
  assert.equal(document.querySelector("h3").textContent, "Başlık");
  assert.equal(document.querySelector("p code").textContent, "var");
  const rendered = parseHTML(`<body>${articleBody(parsed).html}</body>`).document;
  assert.equal(rendered.querySelector("pre code").textContent, "bir\niki");
});

test("Export içindeki gerçek Medium etiketleri okunur; yinelenen ve geçersiz etiketler atlanır", () => {
  const source = exportHtml.replace("</footer>", '<a class="p-tag" href="https://medium.com/tag/csharp">Csharp</a><a class="p-tag" href="https://medium.com/tag/yaz%C4%B1l%C4%B1m">Yazılım</a><a class="p-tag" href="https://medium.com/tag/csharp">Csharp</a><a class="p-tag" href="https://example.org/tag/untrusted">Dış etiket</a><a class="p-tag" href="https://medium.com/tag/%ZZ">Bozuk etiket</a></footer>');
  const imported = parseExport(source);
  assert.deepEqual(imported.categories, ["csharp", "yazılım"]);
  const merged = mergePosts([{ ...imported, categories: [] }], [imported]);
  assert.deepEqual(merged[0].categories, ["csharp", "yazılım"]);
});

test("Dekoratif makale simgeleri SVG olur; kod örneklerinin özgün metni değişmez", () => {
  const sample = { ...post, content: '<p>✅ Tamamlandı. 📦 Paket</p><p><code>📁 folder</code></p><pre>📂 folder</pre>' };
  const rendered = parseHTML(`<body>${articleBody(sample).html}</body>`).document;
  assert.equal(rendered.querySelectorAll("svg.prose-icon").length, 2);
  assert.equal(rendered.querySelector("svg").getAttribute("aria-label"), "Onay");
  assert.equal(rendered.querySelector("p code").textContent, "📁 folder");
  assert.equal(rendered.querySelector("pre code").textContent, "📂 folder");
  assert.ok(sample.content.includes("✅"));
});

test("Yinelenen aktarım dosyaları değiştirmez; kalıcı sayfa güvenli ve doğrudan açılabilir", async () => {
  const root = await mkdtemp(join(tmpdir(), "hc-blog-test-"));
  try {
    const archivePath = join(root, "blog-files/data/archive.json");
    assert.equal((await savePosts([post], archivePath)).changed, true);
    const first = await readFile(archivePath, "utf8");
    assert.equal((await savePosts([post], archivePath)).changed, false);
    assert.equal(await readFile(archivePath, "utf8"), first);
    const template = await readFile(resolve(BLOG_ROOT, "index.html"), "utf8");
    await writeFile(join(root, "index.html"), template);
    await build(root);
    const builtIndex = await readFile(join(root, "index.html"), "utf8");
    const embedded = parseHTML(builtIndex).document.getElementById("posts-data");
    assert.equal(JSON.parse(embedded.textContent).items[0].id, id);
    await build(root);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), builtIndex);
    const localUrl = JSON.parse(embedded.textContent).items[0].localUrl;
    const page = await readFile(join(root, localUrl, "index.html"), "utf8");
    const { document } = parseHTML(page);
    assert.equal(document.querySelector("h1").textContent, post.title);
    assert.equal(document.querySelectorAll(".prose img").length, 0);
    assert.equal(document.querySelectorAll(".reader-toc a").length, 2);
    assert.equal(
      document.querySelector(".brand-avatar img").getAttribute("src"),
      "../../blog-files/img/profile-site.webp",
    );
    assert.equal(document.querySelector(".brand-avatar .avatar-dark").getAttribute("src"), "../../blog-files/img/profile-site-dark.webp");
    assert.ok(
      document.querySelector(".prose pre").textContent.includes("a < b"),
    );
    assert.equal(
      JSON.parse(await readFile(join(root, "blog-files/data/posts.json"), "utf8")).items[0]
        .localUrl,
      localUrl,
    );
    assert.match(localUrl, /^yazi\/[a-z0-9-]+\/$/);
    const redirect = parseHTML(await readFile(join(root, `blog-files/yazilar/${id}/index.html`), "utf8")).document;
    assert.equal(redirect.querySelector('meta[http-equiv="refresh"]').content, `0;url=../../../${localUrl}`);
    assert.equal(document.querySelector('link[rel="canonical"]').href, post.link);
    for (const anchor of document.querySelectorAll('a[href^="#"]'))
      assert.ok(document.getElementById(anchor.getAttribute("href").slice(1)));
    assert.throws(() =>
      renderArticle({ ...post, id: "../../escape" }, template),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ZIP ve klasör önizlemesi projeyi değiştirmez; taslakları ve hesap verilerini listelemez", async () => {
  const root = await mkdtemp(join(tmpdir(), "hc-import-test-"));
  try {
    const zipPath = join(root, "medium.zip");
    await writeFile(
      zipPath,
      zipSync({
        "posts/published.html": strToU8(exportHtml),
        "posts/draft_private.html": strToU8(
          exportHtml.replace("Eski yazı", "ÖZEL TASLAK"),
        ),
        "profile/private.html": strToU8(
          exportHtml.replace("Eski yazı", "ÖZEL PROFİL"),
        ),
      }),
    );
    await mkdir(join(root, "posts"));
    await mkdir(join(root, "profile"));
    await writeFile(join(root, "posts/published.html"), exportHtml);
    await writeFile(join(root, "posts/draft_private.html"), exportHtml.replace("Eski yazı", "ÖZEL TASLAK"));
    await writeFile(join(root, "profile/private.html"), exportHtml.replace("Eski yazı", "ÖZEL PROFİL"));
    const before = await readArchive();
    for (const source of [zipPath, root]) {
      const result = spawnSync(process.execPath, [resolve(FILES_ROOT, "scripts/import-medium.mjs"), source], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes("1 yayımlanmış yazı"));
      assert.ok(!result.stdout.includes("ÖZEL"));
      assert.deepEqual(await readArchive(), before);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
