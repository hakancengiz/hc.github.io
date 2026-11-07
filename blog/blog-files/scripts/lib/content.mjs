import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BLOG_ROOT, FILES_ROOT } from "./paths.mjs";
import { parseHTML } from "linkedom";
import sanitizeHtml from "sanitize-html";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export { BLOG_ROOT, FILES_ROOT };
export const ARCHIVE_PATH = resolve(FILES_ROOT, "data/archive.json");
export const RSS_URL = "https://medium.com/feed/@hakancengiz";
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function htmlDocument(html) {
  return parseHTML(`<!doctype html><html><body>${html}</body></html>`).document;
}

export function textFromHtml(html) {
  const doc = htmlDocument(html);
  doc.querySelectorAll("script,style").forEach((node) => node.remove());
  doc
    .querySelectorAll(
      "p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,br,figcaption,td,th",
    )
    .forEach((node) => node.after(doc.createTextNode(" ")));
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

export function safeUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function mediumUrl(value) {
  const candidate = safeUrl(value);
  if (!candidate) return "";
  const url = new URL(candidate);
  if (url.hostname !== "medium.com" && !url.hostname.endsWith(".medium.com"))
    return "";
  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  return url.href;
}

export function postId(value) {
  const url = mediumUrl(value);
  return url
    ? new URL(url).pathname
        .match(/(?:-|\/)([a-f0-9]{12})\/?$/i)?.[1]
        .toLowerCase() || ""
    : "";
}

export function cleanContent(rawHtml, baseUrl) {
  const doc = htmlDocument(rawHtml);
  doc.querySelectorAll("iframe").forEach((frame) => {
    const url = safeUrl(frame.getAttribute("src"), baseUrl);
    const link = doc.createElement("a");
    link.href = url;
    link.textContent = "Gömülü içeriği aç";
    frame.replaceWith(link);
  });
  return sanitizeHtml(doc.body.innerHTML, {
    allowedTags: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "ul",
      "ol",
      "li",
      "pre",
      "code",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "del",
      "a",
      "img",
      "figure",
      "figcaption",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "sub",
      "sup",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading", "decoding"],
      code: ["class"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedClasses: { code: [/^language-[a-z0-9-]+$/i] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          href: attribs.href?.startsWith("#")
            ? attribs.href
            : safeUrl(attribs.href, baseUrl) ||
              (attribs.href?.startsWith("mailto:") ? attribs.href : ""),
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          src: safeUrl(attribs.src, baseUrl),
          loading: "lazy",
          decoding: "async",
        },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (!frame.attribs.src ||
        /medium\.com\/_\/stat(?:\?|$)/.test(frame.attribs.src) ||
        (frame.attribs.width === "1" && frame.attribs.height === "1")),
  });
}

export function normalizePost(raw, source = "rss") {
  const link = mediumUrl(raw.link);
  const id = postId(link);
  const title = textFromHtml(String(raw.title || ""));
  const dateString = String(raw.pubDate || "");
  const date = new Date(
    dateString.includes("T") || /GMT|[+-]\d{4}/.test(dateString)
      ? dateString
      : dateString.replace(" ", "T") + "Z",
  );
  if (!id || !title || Number.isNaN(date.getTime())) return null;
  const original = String(raw.content || raw.description || "");
  const content = cleanContent(original, link);
  if (!textFromHtml(content)) return null;
  const doc = htmlDocument(content);
  const thumbnail =
    safeUrl(raw.thumbnail) ||
    safeUrl(raw.enclosure?.link) ||
    safeUrl(doc.querySelector("img")?.getAttribute("src"));
  return {
    id,
    title,
    link,
    pubDate: date.toISOString(),
    categories: [
      ...new Set(
        (Array.isArray(raw.categories) ? raw.categories : [])
          .filter((c) => typeof c === "string" && c.trim())
          .map((c) => c.trim()),
      ),
    ],
    thumbnail,
    content,
    fullContent:
      source === "export" || /referrerSource=full_rss/.test(original),
    source,
  };
}

export function parseFeed(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error("Geçersiz RSS belgesi.");
  const data = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
  }).parse(xml);
  const entries = data.rss?.channel?.item;
  if (!entries) throw new Error("RSS içinde yazı bulunamadı.");
  return (Array.isArray(entries) ? entries : [entries])
    .map((item) =>
      normalizePost({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item["content:encoded"] || item.description,
        categories: Array.isArray(item.category)
          ? item.category
          : item.category
            ? [item.category]
            : [],
      }),
    )
    .filter(Boolean);
}

export function parseExport(html, filename = "") {
  if (/(?:^|\/)draft[_-]/i.test(filename)) return null;
  const { document } = parseHTML(html);
  const article = document.querySelector("article.h-entry");
  const body = article?.querySelector(".e-content");
  const title = article?.querySelector(".p-name")?.textContent.trim();
  const date = article
    ?.querySelector("time.dt-published")
    ?.getAttribute("datetime");
  const canonical = article
    ?.querySelector("a.p-canonical")
    ?.getAttribute("href");
  if (!body || !title || !date || !canonical) return null;
  // Medium exports repeat the page title inside the article body.
  const content = body.cloneNode(true);
  const repeatedTitle = content.querySelector("h1.graf--title,h2.graf--title,h3.graf--title,h4.graf--title");
  if (repeatedTitle?.textContent.replace(/\s+/g, " ").trim() === title.replace(/\s+/g, " ").trim())
    repeatedTitle.remove();
  const categories = [...article.querySelectorAll("a.p-tag[href]")].map(tag => {
    const href = mediumUrl(tag.getAttribute("href"));
    if (!href) return "";
    const match = new URL(href).pathname.match(/^\/tag\/([^/]+)\/?$/);
    try {
      return match ? decodeURIComponent(match[1]).toLowerCase().trim() : "";
    } catch {
      return "";
    }
  }).filter(Boolean);
  return normalizePost(
    {
      title: escape(title),
      link: canonical,
      pubDate: date,
      content: content.innerHTML,
      categories,
    },
    "export",
  );
}

export function mergePosts(existing, incoming) {
  const posts = new Map(existing.map((post) => [post.id, post]));
  for (const next of incoming) {
    const previous = posts.get(next.id);
    if (!previous) {
      posts.set(next.id, next);
      continue;
    }
    const content =
      (previous.fullContent && !next.fullContent) ||
      (previous.source === "export" && next.source !== "export")
        ? {
            content: previous.content,
            fullContent: true,
            source: previous.source,
          }
        : {};
    posts.set(next.id, {
      ...previous,
      ...next,
      ...content,
      categories: next.categories.length
        ? next.categories
        : previous.categories,
      thumbnail: next.thumbnail || previous.thumbnail,
    });
  }
  return [...posts.values()].sort(
    (a, b) => b.pubDate.localeCompare(a.pubDate) || a.id.localeCompare(b.id),
  );
}

export async function readArchive(path = ARCHIVE_PATH) {
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.posts))
      throw new Error("Arşiv biçimi geçersiz.");
    return data;
  } catch (error) {
    if (error.code === "ENOENT")
      return { version: 1, updatedAt: null, posts: [] };
    throw error;
  }
}

export async function writeIfChanged(path, value) {
  try {
    if ((await readFile(path, "utf8")) === value) return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
  return true;
}

export async function savePosts(incoming, path = ARCHIVE_PATH) {
  const previous = await readArchive(path);
  const posts = mergePosts(previous.posts, incoming);
  if (JSON.stringify(posts) === JSON.stringify(previous.posts))
    return { changed: false, count: posts.length };
  await writeIfChanged(
    path,
    JSON.stringify(
      { version: 1, updatedAt: new Date().toISOString(), posts },
      null,
      2,
    ) + "\n",
  );
  return { changed: true, count: posts.length };
}
