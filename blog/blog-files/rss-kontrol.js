(() => {
  const output = document.getElementById("latest-article");
  let requestNumber = 0;

  async function checkFeed() {
    const currentRequest = ++requestNumber;
    output.textContent = "RSS kontrol ediliyor…";
    output.setAttribute("aria-busy", "true");

    try {
      // Vary the source URL too, so a cached conversion of the usual feed URL
      // cannot stand in for this visit's check.
      const nonce = `${Date.now()}-${crypto.randomUUID()}`;
      const source = new URL("https://medium.com/feed/@hakancengiz");
      source.searchParams.set("rsskontrol", nonce);
      const endpoint = new URL("https://api.rss2json.com/v1/api.json");
      endpoint.searchParams.set("rss_url", source.href);
      endpoint.searchParams.set("_", nonce);

      const response = await fetch(endpoint.href, {
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
      const data = await response.json();
      if (data.status !== "ok" || !Array.isArray(data.items)) {
        throw new Error("RSS yanıtı geçersiz.");
      }

      const articles = data.items
        .filter(item => typeof item.title === "string" && item.title.trim())
        .map(item => ({
          title: item.title.trim(),
          // rss2json returns UTC timestamps without a timezone suffix.
          published: Date.parse(typeof item.pubDate === "string"
            ? item.pubDate.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2Z")
            : ""),
        }))
        .filter(item => Number.isFinite(item.published))
        .sort((a, b) => b.published - a.published);
      if (!articles.length) throw new Error("RSS içinde yazı bulunamadı.");
      if (currentRequest === requestNumber) output.textContent = articles[0].title;
    } catch {
      if (currentRequest === requestNumber) {
        output.textContent = "RSS şu an kontrol edilemiyor. Sayfayı yenileyip tekrar deneyin.";
      }
    } finally {
      if (currentRequest === requestNumber) output.setAttribute("aria-busy", "false");
    }
  }

  checkFeed();
  // Returning through the back/forward cache also needs a new check.
  window.addEventListener("pageshow", event => {
    if (event.persisted) checkFeed();
  });
})();
