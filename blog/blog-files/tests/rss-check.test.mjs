import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { parseHTML } from "linkedom";
import { writeRssCheck } from "../scripts/lib/rss-check.mjs";

test("RSS kontrolü gelen akışın en yeni yazısını sırasından bağımsız seçer; yalnızca adı görünür", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "hc-rss-check-"));
  try {
    const incoming = [
      { id: "a", title: "Eski yazı", pubDate: "2026-01-01T12:00:00Z" },
      { id: "b", title: 'Yeni yazı <script>alert(1)</script> & C#', pubDate: "2026-11-08T12:00:00Z" },
      { id: "c", title: "Diğer yazı", pubDate: "2026-05-01T12:00:00Z" },
    ];
    assert.equal((await writeRssCheck(incoming, root)).id, "b");
    const filename = resolve(root, "rsskontrol.html");
    const html = await readFile(filename, "utf8");
    const { document } = parseHTML(html);
    assert.equal(document.body.textContent, incoming[1].title);
    assert.equal(document.body.children.length, 0);
    assert.equal(document.querySelectorAll("script").length, 0);
    assert.ok(document.querySelector("style").textContent.includes("background:#fff"));
    assert.equal(document.querySelector('meta[name="robots"]').content, "noindex,nofollow");
    await writeRssCheck(incoming, root);
    assert.equal(await readFile(filename, "utf8"), html);
    await assert.rejects(writeRssCheck([], root));
    assert.equal(await readFile(filename, "utf8"), html);
  } finally {
    assert.ok(root.startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true });
  }
});
