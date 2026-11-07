import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import hljs from "highlight.js/lib/common";
import { articlePath, assignSlugs } from "./lib/routes.mjs";
import { replaceArticleIcons, withoutDecorativeEmoji } from "./lib/article-icons.mjs";
import { buildSeriesIndex, createRelatedSelector, parseSeriesTitle } from "./lib/discovery.mjs";
import { FILES_DIR } from "./lib/paths.mjs";
import {
  BLOG_ROOT,
  readArchive,
  writeIfChanged,
  htmlDocument,
  textFromHtml,
  cleanContent,
  escape,
} from "./lib/content.mjs";

export function embedIndexData(html, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const block = `<script id="posts-data" type="application/json">${json}</script>`;
  const pattern = /<script\b[^>]*id="posts-data"[^>]*>[\s\S]*?<\/script>/;
  return pattern.test(html) ? html.replace(pattern, () => block) : html.replace("</head>", `  ${block}\n  </head>`);
}

export function articleBody(post) {
  const doc = htmlDocument(cleanContent(post.content, post.link));
  // Keep every article image at its source position; the header adds no cover.
  doc.querySelectorAll("img").forEach((image, index) => {
    const frame = doc.createElement("span");
    frame.className = "reader-image";
    const atmosphere = doc.createElement("span");
    atmosphere.className = "reader-image-atmosphere";
    atmosphere.setAttribute("aria-hidden", "true");
    const palette = doc.createElement("img");
    palette.src = image.getAttribute("src");
    palette.alt = "";
    palette.setAttribute("loading", "lazy");
    palette.setAttribute("decoding", "async");
    atmosphere.append(palette);
    image.replaceWith(frame);
    image.classList.add("reader-content-image");
    if (index === 0) {
      image.setAttribute("loading", "eager");
      image.setAttribute("fetchpriority", "high");
    }
    frame.append(atmosphere, image);
  });
  const toc = [];
  // Some RSS entries lose inline-code tags. Restore only unambiguous definition prefixes.
  doc.querySelectorAll("h2,h3,h4,h5,h6").forEach(heading => {
    const definition = heading.textContent.trim().match(/^([A-Za-z_$][\w$]*(?:\(\))?)\s+nedir\??$/i);
    const paragraph = heading.nextElementSibling;
    const first = paragraph?.firstChild;
    if (!definition || paragraph?.tagName !== "P" || first?.nodeType !== 3) return;
    const term = definition[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = first.textContent.match(new RegExp(`^(\\s*)(${term})(?=[\\s,.;:]|$)`, "i"));
    if (!prefix) return;
    const fragment = doc.createDocumentFragment();
    if (prefix[1]) fragment.append(doc.createTextNode(prefix[1]));
    const code = doc.createElement("code");
    code.textContent = prefix[2];
    fragment.append(code, doc.createTextNode(first.textContent.slice(prefix[0].length)));
    first.replaceWith(fragment);
  });
  const autoLanguages = ["csharp", "javascript", "typescript", "json", "xml", "css", "sql", "bash", "python", "yaml"];
  if (post.categories?.includes("css")) autoLanguages.unshift("css", "xml");
  doc.querySelectorAll("pre").forEach(pre => {
    const languageHint = pre.querySelector("code")?.className.match(/(?:^|\s)language-([\w-]+)/)?.[1];
    // RSS represents code line breaks with <br>; keep them as actual newlines.
    const source = pre.cloneNode(true);
    source.querySelectorAll("br").forEach(br => br.replaceWith(doc.createTextNode("\n")));
    const codeText = source.textContent;
    const highlighted = languageHint && hljs.getLanguage(languageHint)
      ? hljs.highlight(codeText, { language: languageHint, ignoreIllegals: true })
      : hljs.highlightAuto(codeText, [...new Set(autoLanguages)]);
    const code = doc.createElement("code");
    code.className = `hljs language-${highlighted.language || "plaintext"}`;
    code.innerHTML = highlighted.value;
    pre.replaceChildren(code);
  });
  replaceArticleIcons(doc);
  doc.querySelectorAll("h1,h2,h3").forEach((heading, index) => {
    heading.id = `bolum-${index + 1}`;
    toc.push({ id: heading.id, text: heading.textContent.trim() });
  });
  return { html: doc.body.innerHTML, toc };
}

export function renderArticle(post, sourceHtml, related = [], series = null) {
  if (!/^[a-f0-9]{12}$/.test(post.id))
    throw new Error("Geçersiz yazı kimliği.");
  const { document } = parseHTML(sourceHtml);
  const header = document.querySelector(".site-header").cloneNode(true);
  header.querySelectorAll("[src],[href]").forEach((node) => {
    for (const attr of ["src", "href"]) {
      const value = node.getAttribute(attr);
      if (value && !/^(?:https?:|mailto:|#)/.test(value))
        node.setAttribute(attr, ["index.html", "./"].includes(value) ? "../../" : `../../${value}`);
    }
  });
  const symbols = document.querySelector(".icon-library").outerHTML;
  const fonts =
    document.querySelector('link[href*="fonts.googleapis.com/css"]')
      ?.outerHTML || "";
  const { html, toc } = articleBody(post);
  const text = textFromHtml(post.content);
  const excerpt = withoutDecorativeEmoji(text).slice(0, 170);
  const image = escape(post.thumbnail || "../../blog-files/img/article-fallback.svg");
  const minutes = Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(post.pubDate));
  const visibleCategory = post.categories.find(
    (c) =>
      !["türkçe", "turkce", "turkish", "english"].includes(
        c.toLocaleLowerCase("tr-TR"),
      ),
  );
  const tocMarkup = toc.length < 2 ? "" : `<div class="reader-toc-panel" id="reader-toc-panel"><div class="reader-toc-panel-inner"><aside class="reader-toc"><details open>
    <summary><span class="toc-symbol" aria-hidden="true"><svg class="icon"><use href="#i-list"></use></svg></span><span class="toc-label">Bu yazıda</span><span class="toc-count">${toc.length}<span class="sr-only"> bölüm</span></span><svg class="icon toc-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></summary>
    <nav aria-label="İçindekiler">${toc.map((item, index) => `<a href="#${item.id}" aria-label="${escape(item.text)}"><span class="toc-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span class="toc-title">${escape(item.text.replace(/^\s*\d+[.)]\s*/, ""))}</span></a>`).join("")}</nav>
  </details></aside></div></div>`;
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const tocToggle = toc.length < 2 ? "" : `<button class="reader-toc-toggle" id="reader-toc-toggle" type="button" aria-expanded="false" aria-controls="reader-toc-panel">${icon("list")}<span>Bu yazıda</span><svg class="icon toc-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></button>`;
  const seriesMarkup = series ? `<details class="reader-series" style="--series-progress:${Math.round(series.position / series.total * 100)}%">
    <summary><span class="series-symbol" aria-hidden="true">${icon("list")}</span><span class="series-summary-title"><span>${escape(series.name)}</span><span aria-hidden="true">·</span><span class="series-position">${series.continuous ? `${series.position}/${series.total}` : `${series.part}. bölüm · ${series.total} yazı`}</span></span><span class="series-toggle-label"><span>Bölümler</span><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></span></summary>
    <nav aria-label="${escape(series.name)} bölümleri"><ol class="series-chapters">${series.chapters.map(chapter => `<li><a data-article-link href="../../${articlePath(chapter.post)}"${chapter.post.id === post.id ? ' aria-current="page"' : ""}><span class="series-chapter-number" aria-hidden="true">${String(chapter.part).padStart(2, "0")}</span><span>${escape(chapter.chapterTitle)}</span>${chapter.post.id === post.id ? '<span class="sr-only">Şu an okuduğun bölüm</span>' : ""}</a></li>`).join("")}</ol></nav>
  </details>` : "";
  const seriesNav = series && (series.previous || series.next) ? `<nav class="reader-series-nav" aria-label="Seride gezin">${["previous", "next"].map(direction => {
    const chapter = series[direction];
    if (!chapter) return "";
    const label = direction === "previous" ? "Önceki bölüm" : "Sonraki bölüm";
    return `<a class="series-${direction}" data-article-link href="../../${articlePath(chapter)}"><span class="series-nav-direction">${direction === "previous" ? icon("arrow") : ""}${label}${direction === "next" ? icon("arrow") : ""}</span><strong>${escape(parseSeriesTitle(chapter.title)?.chapterTitle || chapter.title)}</strong></a>`;
  }).join("")}</nav>` : "";
  const relatedMarkup = related.length ? `<section class="reader-related" aria-labelledby="related-heading"><h2 id="related-heading">Diğer yazılar</h2><div>${related.map(item => {
    const cover = escape(item.thumbnail || "../../blog-files/img/article-fallback.svg");
    const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.pubDate));
    return `<a class="article-card" href="../../${articlePath(item)}"><div class="card-atmosphere" aria-hidden="true"><img class="article-ambience" src="${cover}" alt="" loading="lazy" decoding="async"></div><div class="article-image"><img src="${cover}" alt="" loading="lazy" decoding="async"></div><div class="article-body"><time class="article-meta" datetime="${item.pubDate}">${shortDate}</time><h3 class="article-title">${escape(item.title)}</h3><div class="article-footer"><span>Yazıyı oku</span>${icon("arrow")}</div></div></a>`;
  }).join("")}</div></section>` : "";
  return `<!doctype html>
<html lang="tr" data-theme="dark"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(post.title)} — Hakan Cengiz</title>
  <meta name="description" content="${escape(excerpt)}"><meta name="theme-color" content="#111822">
  <meta property="og:type" content="article"><meta property="og:title" content="${escape(post.title)}"><meta property="og:description" content="${escape(excerpt)}">
  ${post.thumbnail ? `<meta property="og:image" content="${image}">` : ""}<meta property="article:published_time" content="${post.pubDate}">
  <link rel="canonical" href="${escape(post.link)}"><link rel="icon" href="../../blog-files/img/rss-img/blog-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${fonts}
  <script>try{const savedTheme=localStorage.getItem('theme');if(savedTheme==='light'||savedTheme==='dark')document.documentElement.dataset.theme=savedTheme}catch{}document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#111822':'#ffffff';</script>
  <link rel="stylesheet" href="../../blog-files/styles.css?v=20261108-intro"><link rel="stylesheet" href="../../blog-files/reader.css?v=20261108-images"><script src="../../blog-files/reader.js" defer></script>
</head><body id="top">
  <a class="skip-link" href="#makale">Makaleye geç</a>${symbols}
  <div class="reading-progress" aria-hidden="true"><span id="reading-progress"></span></div>${header.outerHTML}
  <main class="container reader-main" id="makale">
    <div class="reader-toolbar-anchor" id="reader-toolbar-anchor"><div class="reader-toolbar" id="reader-toolbar"><a class="reader-back" href="../../">${icon("arrow")}<span>Tüm yazılara dön</span></a>${tocToggle}<div class="reader-toolbar-theme" id="reader-toolbar-theme"></div></div></div>
    <article class="reader-layout${toc.length < 2 ? " no-toc" : ""}">
      ${tocMarkup}
      <div class="reader-content">
      <header class="reader-hero">
        <div class="reader-atmosphere" aria-hidden="true"><img class="reader-ambience" src="${image}" alt="" decoding="async"></div>
        <div class="reader-heading">
          <h1>${escape(post.title)}</h1>
          <div class="reader-meta">${visibleCategory ? `<span>${escape(visibleCategory)}</span><i aria-hidden="true">·</i>` : ""}<time datetime="${post.pubDate}">${date}</time><i aria-hidden="true">·</i><span>~${minutes} dk okuma</span><button class="share-button" id="share-button" type="button" aria-label="Bağlantıyı kopyala" title="Bağlantıyı kopyala"><svg class="icon share-copy-icon" aria-hidden="true"><use href="#i-copy"></use></svg><svg class="icon share-check-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"></path></svg></button><span id="share-status" class="sr-only" role="status"></span></div>
          ${seriesMarkup}
        </div>
      </header>
        <div class="reader-article">
          <div class="prose">${html}</div>
          ${!post.fullContent ? `<p class="reader-notice">Bu yazının tamamını <a href="${escape(post.link)}" target="_blank" rel="noopener noreferrer">Medium'da okuyabilirsin ${icon("up-right")}</a>.</p>` : ""}
          ${seriesNav}
          <footer class="reader-source"><div class="reader-author"><img src="../../blog-files/img/profile-site.webp" width="40" height="40" alt="" loading="lazy" decoding="async"><span>Hakan Cengiz</span></div><a href="${escape(post.link)}" target="_blank" rel="noopener noreferrer">Medium'da görüntüle ${icon("up-right")}</a></footer>
        </div>
      </div>
    </article>
    ${relatedMarkup}
  </main>
  <footer class="container site-footer"><span>© ${new Date().getFullYear()} Hakan Cengiz</span><a href="#top" aria-label="Sayfanın başına dön">Başa dön ${icon("up")}</a></footer>
</body></html>\n`;
}

export function renderRedirect(post, destination = `../../../${articlePath(post)}`) {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(post.title)} — Hakan Cengiz</title>
<link rel="canonical" href="https://hcengiz.com/blog/${articlePath(post)}">
<script>const target=new URL(${JSON.stringify(destination)}+(location.protocol==='file:'?'index.html':''),location.href);target.search=location.search;target.hash=location.hash;location.replace(target.href);</script>
<meta http-equiv="refresh" content="0;url=${destination}"></head>
<body><p>Yazının adresi güncellendi. <a href="${destination}">Yazıya devam et</a></p></body></html>\n`;
}

export async function build(root = BLOG_ROOT) {
  const archive = await readArchive(resolve(root, FILES_DIR, "data/archive.json"));
  if (!archive.posts.length)
    throw new Error("Önce npm run sync ile yazıları alın.");
  const template = await readFile(resolve(root, "index.html"), "utf8");
  const routesPath = resolve(root, FILES_DIR, "data/routes.json");
  let previousRoutes = {};
  try {
    const saved = JSON.parse(await readFile(routesPath, "utf8"));
    if (saved.version !== 1 || !saved.routes || typeof saved.routes !== "object" || Array.isArray(saved.routes))
      throw new Error("Yazı adresleri dosyası geçersiz.");
    previousRoutes = saved.routes;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const routes = assignSlugs(archive.posts, previousRoutes);
  const posts = archive.posts.map(post => ({ ...post, slug: routes[post.id] }));
  const seriesIndex = buildSeriesIndex(posts);
  const relatedPosts = createRelatedSelector(posts);
  const items = [];
  for (const post of posts) {
    const html = renderArticle(
      post,
      template,
      relatedPosts(post),
      seriesIndex.get(post.id),
    );
    await writeIfChanged(resolve(root, articlePath(post), "index.html"), html);
    await writeIfChanged(resolve(root, FILES_DIR, "yazilar", post.id, "index.html"), renderRedirect(post));
    const text = textFromHtml(post.content);
    items.push({
      id: post.id,
      title: post.title,
      link: post.link,
      localUrl: articlePath(post),
      pubDate: post.pubDate,
      categories: post.categories,
      series: parseSeriesTitle(post.title),
      thumbnail: post.thumbnail,
      description: withoutDecorativeEmoji(text).slice(0, 500),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  }
  const indexData = { version: 1, updatedAt: archive.updatedAt, items };
  await writeIfChanged(routesPath, JSON.stringify({ version: 1, routes }, null, 2) + "\n");
  await writeIfChanged(
    resolve(root, FILES_DIR, "data/posts.json"),
    JSON.stringify(indexData, null, 2) + "\n",
  );
  await writeIfChanged(resolve(root, "index.html"), embedIndexData(template, indexData));
  console.log(`${items.length} kalıcı makale sayfası ve yazı listesi hazır.`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  build().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
