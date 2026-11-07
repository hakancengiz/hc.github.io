"use strict";

(() => {
  if (window.location.protocol === "file:") {
    document.querySelector('.brand[href="./"]')?.setAttribute("href", "index.html");
  }
  const DATA_URL = "blog-files/data/posts.json";
  const CACHE_KEY = "hc-blog-feed-v3";
  const PAGE_SIZE = 6;
  const CATEGORY_LABELS = {
    "software-development": "Yazılım Geliştirme",
    "software-engineering": "Yazılım Mühendisliği",
    csharp: "C#",
    dotnet: ".NET",
    api: "API",
    interview: "Mülakat",
    yazılım: "Yazılım",
    web: "Web",
    security: "Güvenlik",
    "design-patterns": "Tasarım Desenleri",
    "repository-pattern": "Repository Pattern",
    "load-balancing": "Load Balancing",
    servers: "Sunucular",
    data: "Veri",
    jwt: "JWT",
    token: "Token",
    authentication: "Kimlik Doğrulama",
    flexbox: "Flexbox",
    css: "CSS",
    html: "HTML",
    react: "React",
    javascript: "JavaScript",
    "net-core": ".NET Core",
    aspnetcore: "ASP.NET Core",
    "aspnet-mvc": "ASP.NET MVC",
    "entity-framework-core": "Entity Framework Core",
    "dependency-injection": "Dependency Injection",
    "c-sharp-programming": "C#",
    sql: "SQL",
    mvc: "MVC",
    ui: "UI",
    "web-development": "Web Geliştirme",
    "front-end-development": "Frontend",
    "software-testing": "Yazılım Testi",
  };
  const categoryLabel = (value) => CATEGORY_LABELS[value] || value.split("-").map(word => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1)).join(" ");
  const $ = (id) => document.getElementById(id);
  const state = {
    items: [],
    category: "all",
    series: "",
    query: "",
    limit: PAGE_SIZE,
    loading: false,
  };
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fold = (value) =>
    String(value)
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i");
  const icon = (name) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    },
  };
  const sentinel = $("feed-sentinel");
  const lazyObserver = typeof window.IntersectionObserver === "function"
    ? new window.IntersectionObserver(entries => {
      if (entries.some(entry => entry.target === sentinel && entry.isIntersecting)) loadNextPage();
    }, { rootMargin: "0px 0px 480px 0px", threshold: 0 })
    : null;
  const revealObserver = typeof window.IntersectionObserver === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? new window.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        entry.target.classList.add("is-entering");
        entry.target.addEventListener("animationend", () => {
          entry.target.classList.remove("is-entering");
          entry.target.style.removeProperty("--enter-delay");
        }, { once: true });
      });
    }, { rootMargin: "0px 0px 24px 0px", threshold: 0.08 })
    : null;

  function loadNextPage() {
    if (state.loading || sentinel.hidden) return;
    state.limit += PAGE_SIZE;
    renderArticles(true);
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function normalizeItem(item) {
    if (!item || !/^[a-f0-9]{12}$/.test(item.id) || !item.title) return null;
    const date = new Date(item.pubDate);
    const localPath = typeof item.localUrl === "string" && /^(?:blog-files\/)?yazi\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(item.localUrl)
      ? item.localUrl.replace(/^blog-files\//, "")
      : "blog-files/yazilar/" + item.id + "/";
    const series = item.series && typeof item.series.key === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.series.key)
      && typeof item.series.name === "string" && item.series.name.trim() && Number.isInteger(item.series.part) && item.series.part > 0
      ? { key: item.series.key, name: item.series.name.trim(), part: item.series.part }
      : null;
    return {
      id: item.id,
      title: String(item.title),
      link: safeUrl(item.link),
      localUrl: localPath + (window.location.protocol === "file:" ? "index.html" : ""),
      series,
      cover: safeUrl(item.thumbnail),
      description: String(item.description || ""),
      categories: Array.isArray(item.categories)
        ? item.categories.filter((c) => typeof c === "string" && c.trim())
        : [],
      date: Number.isNaN(date.getTime()) ? null : date,
      minutes: Math.max(1, Math.ceil((Number(item.wordCount) || 1) / 200)),
    };
  }

  function meta(item) {
    return `<div class="article-meta">${item.date ? `<time datetime="${item.date.toISOString()}">${escape(dateFormatter.format(item.date))}</time><span class="meta-dot" aria-hidden="true">·</span>` : ""}<span class="read-time">${icon("clock")}~${item.minutes} dk okuma</span></div>`;
  }

  function cover(item, index) {
    return `<img src="${escape(item.cover || "blog-files/img/article-fallback.svg")}" alt="" ${index < 3 ? 'loading="eager"' : 'loading="lazy"'} decoding="async"><span class="article-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>`;
  }

  function cardAmbience(item) {
    return `<div class="card-atmosphere" aria-hidden="true"><img class="article-ambience" src="${escape(item.cover || "blog-files/img/article-fallback.svg")}" alt="" loading="lazy" decoding="async"></div>`;
  }

  function attachImageFallbacks(root) {
    root.querySelectorAll("img").forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          image.src = "blog-files/img/article-fallback.svg";
        },
        { once: true },
      );
      if (image.complete && image.naturalWidth === 0)
        image.src = "blog-files/img/article-fallback.svg";
    });
  }

  function articleCategory(item) {
    const category = item.categories.find(
      (c) =>
        !["türkçe", "turkce", "turkish", "english"].includes(
          c.toLocaleLowerCase("tr-TR"),
        ),
    );
    return category
      ? `<span class="category-label">${escape(categoryLabel(category))}</span>`
      : "";
  }

  function renderSpotlight() {
    const item = state.items[0];
    if (!item) return;
    // A blurred cover provides its palette without cross-origin pixel access.
    const image = escape(item.cover || "blog-files/img/article-fallback.svg");
    $("spotlight").innerHTML = `
      <a class="spotlight-card" href="${escape(item.localUrl)}">
        <div class="card-atmosphere" aria-hidden="true">
          <img class="spotlight-ambience" src="${image}" alt="" decoding="async">
          <div class="spotlight-shade"></div>
        </div>
        <div class="spotlight-copy">
          <div class="spotlight-details">${articleCategory(item)}${meta(item)}</div>
          <h2 id="spotlight-title" class="spotlight-title">${escape(item.title)}</h2>
          ${item.description ? `<p class="spotlight-description">${escape(item.description.slice(0, 260))}${item.description.length > 260 ? "…" : ""}</p>` : ""}
          <span class="spotlight-read">Yazıyı oku <span>${icon("arrow")}</span></span>
        </div>
        <div class="spotlight-art">
          <img class="spotlight-cover" src="${image}" alt="" fetchpriority="high" decoding="async">
        </div>
        
      </a>`;
    attachImageFallbacks($("spotlight"));
  }

  function renderFilters() {
    const counts = new Map();
    const seriesGroups = new Map();
    state.items.forEach(item => {
      if (!item.series) return;
      const group = seriesGroups.get(item.series.key) || { ...item.series, count: 0 };
      group.count++;
      seriesGroups.set(item.series.key, group);
    });
    state.items.forEach((item) =>
      item.categories.forEach((category) =>
        counts.set(category, (counts.get(category) || 0) + 1),
      ),
    );
    const categories = [...counts]
      .filter(
        ([category]) =>
          !["türkçe", "turkce", "turkish", "english"].includes(
            category.toLocaleLowerCase("tr-TR"),
          ),
      )
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .slice(0, 5);
    $("filters").innerHTML =
      '<button class="filter active" data-category="all" aria-pressed="true">Tümü</button>' +
      [...seriesGroups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"))
        .map(series => `<button class="filter filter-series" data-series="${escape(series.key)}" aria-pressed="false" aria-label="${escape(series.name)}, ${series.count} bölüm">${icon("list")}<span>${escape(series.name)}</span><span class="filter-count" aria-hidden="true">${series.count}</span></button>`).join("") +
      categories
        .map(
          ([category]) =>
            `<button class="filter" data-category="${escape(category)}" aria-pressed="false">${escape(categoryLabel(category))}</button>`,
        )
        .join("");
  }

  function renderArticles(append = false) {
    lazyObserver?.unobserve(sentinel);
    if (!append) revealObserver?.disconnect();
    const query = fold(state.query.trim());
    const filtered = state.items.filter(
      (item) =>
        (state.category === "all" ||
          item.categories.includes(state.category)) &&
        (!state.series || item.series?.key === state.series) &&
        (!query ||
          fold(
            `${item.title} ${item.description} ${item.categories.map(categoryLabel).join(" ")} ${item.categories.join(" ")}`,
          ).includes(query)),
    );
    if (state.series) filtered.sort((a, b) => a.series.part - b.series.part || (a.date?.getTime() || 0) - (b.date?.getTime() || 0) || a.id.localeCompare(b.id));
    const showSpotlight =
      state.items.length > 0 && state.category === "all" && !state.series && !query;
    $("spotlight-section").hidden = !showSpotlight;
    const remaining = showSpotlight ? filtered.slice(1) : filtered;
    // Render all results if automatic loading is unavailable, so no article is stranded.
    const limit = lazyObserver ? state.limit : remaining.length;
    const start = append ? $("feed").children.length : 0;
    const visible = remaining.slice(start, limit);
    const shownCount = Math.min(limit, remaining.length) + (showSpotlight ? 1 : 0);
    const cards = document.createElement("template");
    cards.innerHTML = visible
      .map(
        (item) =>
          `<a class="article-card" href="${escape(item.localUrl)}">${cardAmbience(item)}<div class="article-image">${cover(item, state.items.indexOf(item))}</div><div class="article-body">${articleCategory(item)}<h3 class="article-title">${escape(item.title)}</h3><p class="article-desc">${escape(item.description.slice(0, 170))}${item.description.length > 170 ? "…" : ""}</p><div class="article-footer">${meta(item)}${icon("up-right")}</div></div></a>`,
      )
      .join("");
    const newCards = [...cards.content.children];
    if (!append) $("feed").replaceChildren();
    $("feed").append(cards.content);
    newCards.forEach(attachImageFallbacks);
    if (append && revealObserver) newCards.forEach((card, index) => {
      card.style.setProperty("--enter-delay", `${index % 3 * 35}ms`);
      revealObserver.observe(card);
    });
    $("empty-state").hidden = filtered.length > 0 || state.items.length === 0;
    sentinel.hidden = limit >= remaining.length;
    if (!sentinel.hidden) lazyObserver?.observe(sentinel);
    $("showing-count").textContent = state.items.length
      ? `${filtered.length} yazıdan ${shownCount} tanesi gösteriliyor`
      : "";
    $("results-summary").textContent =
      `${filtered.length} yazı bulundu. ${shownCount} yazı gösteriliyor.`;
    $("filters")
      .querySelectorAll("button")
      .forEach((button) => {
        const active = button.dataset.series
          ? button.dataset.series === state.series
          : !state.series && button.dataset.category === state.category;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }

  function applyItems(rawItems) {
    const seen = new Set();
    const items = rawItems
      .map(normalizeItem)
      .filter((item) => {
        if (!item || seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      })
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    if (!items.length) throw new Error("Empty feed");
    state.items = items;
    state.category = "all";
    state.series = "";
    state.limit = PAGE_SIZE;
    $("article-count").textContent = `${items.length} yazı`;
    $("article-count").hidden = false;
    $("error-state").hidden = true;
    renderSpotlight();
    renderFilters();
    renderArticles();
  }

  function status(text, mode) {
    $("feed-status").dataset.state = mode;
    $("feed-status").innerHTML =
      `<svg class="status-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4"></circle></svg>${escape(text)}`;
  }

  async function init() {
    if (state.loading) return;
    state.loading = true;
    $("retry-button").disabled = true;
    $("feed").setAttribute("aria-busy", "true");
    status("Yükleniyor", "loading");
    try {
      let data;
      const snapshot = $("posts-data");
      if (snapshot) {
        try {
          const embedded = JSON.parse(snapshot.textContent);
          if (embedded.version === 1 && Array.isArray(embedded.items) && embedded.items.some(normalizeItem)) data = embedded;
        } catch (_) {}
      }
      if (!data) {
        const response = await fetch(DATA_URL, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Feed request failed");
        data = await response.json();
      }
      if (data.version !== 1 || !Array.isArray(data.items))
        throw new Error("Invalid feed");
      applyItems(data.items);
      storage.set(
        CACHE_KEY,
        JSON.stringify({ items: data.items, savedAt: Date.now() }),
      );
      status("Güncel", "live");
    } catch (_) {
      let cached = false;
      try {
        const saved = JSON.parse(storage.get(CACHE_KEY));
        if (
          Array.isArray(saved?.items) &&
          Number.isFinite(saved.savedAt) &&
          Date.now() - saved.savedAt < 7 * 86400000
        ) {
          applyItems(saved.items);
          cached = true;
          status("Son kaydedilen yazılar", "cached");
        }
      } catch (_) {}
      if (!cached) {
        lazyObserver?.unobserve(sentinel);
        revealObserver?.disconnect();
        sentinel.hidden = true;
        $("feed").replaceChildren();
        $("spotlight-section").hidden = true;
        $("error-state").hidden = false;
        $("empty-state").hidden = true;
        status("Bağlantı kurulamadı", "error");
      }
    } finally {
      state.loading = false;
      $("retry-button").disabled = false;
      $("feed").setAttribute("aria-busy", "false");
    }
  }

  function syncTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    $("theme-button").setAttribute(
      "aria-label",
      dark ? "Açık temaya geç" : "Koyu temaya geç",
    );
    $("theme-button").setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#111822"
      : "#ffffff";
  }
  $("theme-button").addEventListener("click", () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    storage.set("theme", document.documentElement.dataset.theme);
    syncTheme();
  });
  $("filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category],button[data-series]");
    if (!button) return;
    state.series = button.dataset.series || "";
    state.category = button.dataset.category || "all";
    state.limit = PAGE_SIZE;
    renderArticles();
  });
  $("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    state.limit = PAGE_SIZE;
    renderArticles();
  });
  $("reset-filters").addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    state.series = "";
    state.limit = PAGE_SIZE;
    $("search").value = "";
    renderArticles();
    $("search").focus();
  });
  function setView(view) {
    const list = view === "list";
    $("feed").classList.toggle("list-view", list);
    ["grid", "list"].forEach((name) => {
      $(`${name}-view`).classList.toggle("active", name === view);
      $(`${name}-view`).setAttribute("aria-pressed", String(name === view));
    });
    storage.set("hc-blog-view", view);
  }
  $("grid-view").addEventListener("click", () => setView("grid"));
  $("list-view").addEventListener("click", () => setView("list"));
  $("retry-button").addEventListener("click", init);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.target.closest("input,textarea,select,[contenteditable]")
    ) {
      event.preventDefault();
      $("search").focus();
    }
    if (event.key === "Escape" && event.target === $("search")) {
      $("search").value = "";
      state.query = "";
      state.limit = PAGE_SIZE;
      renderArticles();
    }
  });
  $("year").textContent = new Date().getFullYear();
  syncTheme();
  setView(storage.get("hc-blog-view") === "list" ? "list" : "grid");
  init();
})();
