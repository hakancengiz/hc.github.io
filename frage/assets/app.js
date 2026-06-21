const dom = {
  root: document.documentElement,
  themeToggle: document.querySelector("#themeToggle"),
  sourcesButton: document.querySelector("#sourcesButton"),
  closeSourcesButton: document.querySelector("#closeSourcesButton"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  sourceModal: document.querySelector("#sourceModal"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  clearButton: document.querySelector("#clearButton"),
  resultsList: document.querySelector("#resultsList"),
  resultsStrip: document.querySelector(".results-strip"),
  resultsScrollNext: document.querySelector("#resultsScrollNext"),
  resultCount: document.querySelector("#resultCount"),
  resultSummary: document.querySelector("#resultSummary"),
  dataStatus: document.querySelector("#dataStatus"),
  dataStatusPill: document.querySelector("#dataStatusPill"),
  recentSearches: document.querySelector("#recentSearches"),
  recentSearchList: document.querySelector("#recentSearchList"),
  clearRecentSearches: document.querySelector("#clearRecentSearches"),
  exampleSearchList: document.querySelector("#exampleSearchList"),
  favoriteSearches: document.querySelector("#favoriteSearches"),
  favoriteSearchList: document.querySelector("#favoriteSearchList"),
  exportFavorites: document.querySelector("#exportFavorites"),
  importFavorites: document.querySelector("#importFavorites"),
  favoriteImportInput: document.querySelector("#favoriteImportInput"),
  clearFavorites: document.querySelector("#clearFavorites"),
  emptyState: document.querySelector("#emptyState"),
  entryDetail: document.querySelector("#entryDetail"),
};

let activeIndex = 0;
let currentResults = [];
let currentSpokenWord = "";
let currentEntry = null;
let exampleDisplayMode = "both";
let previousFocusTarget = null;
let searchRunId = 0;
let searchDebounceTimer = null;
let appInitialized = false;
let workerRequestId = 0;
let recentSearchMemory = [];
let favoriteMemory = [];
const workerRequests = new Map();
const SEARCH_DEBOUNCE_MS = 160;
const RECENT_SEARCHES_KEY = "frage-recent-searches";
const RECENT_SEARCH_LIMIT = 6;
const STARTER_SEARCH_POOL = Object.freeze([
  "avoir", "faire", "aller", "dire", "vouloir", "savoir", "venir", "voir", "prendre", "mettre",
  "donner", "parler", "aimer", "trouver", "demander", "rester", "penser", "arriver", "croire", "attendre",
  "comprendre", "apprendre", "commencer", "finir", "vivre", "travailler", "jouer", "manger", "boire", "lire",
  "regarder", "chercher", "choisir", "acheter", "payer", "ouvrir", "fermer", "entrer", "sortir", "partir",
  "monter", "marcher", "courir", "nager", "habiter", "aider", "appeler", "expliquer", "montrer", "changer",
  "utiliser", "essayer", "perdre", "rencontrer", "sentir", "entendre", "sourire", "rire", "pleurer", "oublier",
  "conduire", "envoyer", "laver", "inviter", "partager", "offrir", "devenir", "mourir", "maison", "ecole",
  "livre", "voiture", "travail", "jour", "annee", "homme", "femme", "enfant", "ami", "famille",
  "ville", "langue", "mot", "question", "reponse", "heure", "argent", "eau", "cafe", "porte",
  "chambre", "rue", "medecin", "professeur", "etudiant", "musique", "film", "telephone", "ordinateur", "idee"
]);
const STARTER_SEARCH_LABELS = Object.freeze({
  ecole: "\u00e9cole",
  annee: "ann\u00e9e",
  reponse: "r\u00e9ponse",
  medecin: "m\u00e9decin",
  etudiant: "\u00e9tudiant",
  cafe: "caf\u00e9",
  idee: "id\u00e9e",
});
const STARTER_SEARCH_COUNT = 4;
const STARTER_SEARCH_FALLBACKS = Object.freeze(["maison", "ecole", "chercher", "manger"]);
const FAVORITES_KEY = "frage-favorites";
const FAVORITE_LIMIT = 24;
const FAVORITE_IMPORT_MAX_BYTES = 64 * 1024;
const FAVORITE_HEADWORD_MAX_LENGTH = 120;
const FAVORITE_TRANSLATION_MAX_LENGTH = 160;
const FAVORITE_TRANSLATION_LIMIT = 12;
const FAVORITE_IMPORT_MIME_TYPES = new Set(["application/json", "text/json", "application/ld+json", ""]);
const EXAMPLE_DISPLAY_KEY = "frage-example-display";

function isFileMode() {
  return window.location.protocol === "file:";
}

function createDataWorker() {
  if (isFileMode()) return null;
  if (!window.Worker) return null;

  try {
    return new Worker("assets/db-worker.js?v=38");
  } catch {
    return null;
  }
}

const dbWorker = createDataWorker();

if (dbWorker) {
  dbWorker.addEventListener("message", (event) => {
    const { id, ok, payload, error } = event.data;
    const request = workerRequests.get(id);
    if (!request) return;

    workerRequests.delete(id);

    if (ok) {
      request.resolve(payload);
      return;
    }

    request.reject(new Error(error || "Veri katmanı hatası"));
  });
}

function requestWorker(type, payload = {}) {
  if (!dbWorker) {
    if (!window.FRAGE_DATA) {
      return Promise.reject(new Error("Yerel veri katmanı yüklenemedi."));
    }

    if (type === "SEARCH") {
      return Promise.resolve(window.FRAGE_DATA.searchEntries(payload.query || ""));
    }

    if (type === "GET_ENTRY") {
      return Promise.resolve(window.FRAGE_DATA.getEntry(payload.entryId));
    }

    if (type === "STATUS") {
      return Promise.resolve({
        source: "js",
        sqliteReady: false,
        sqliteError: null,
        mode: isFileMode() ? "file" : "fallback",
        packages: { core: true, forms: true, examples: true },
      });
    }

    return Promise.reject(new Error("Veri katmanı hatası"));
  }

  const id = ++workerRequestId;

  return new Promise((resolve, reject) => {
    workerRequests.set(id, { resolve, reject });
    dbWorker.postMessage({ id, type, payload });
  });
}

function searchEntries(query) {
  return requestWorker("SEARCH", { query });
}

function getEntry(entryId) {
  return requestWorker("GET_ENTRY", { entryId });
}

function getDataStatus() {
  return requestWorker("STATUS");
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("frage-theme");
    if (saved) return saved;
  } catch {
    // Some embedded or file-based browser contexts can block localStorage.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readRecentSearches() {
  try {
    if (typeof localStorage === "undefined") return recentSearchMemory;
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return recentSearchMemory;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return recentSearchMemory;
    recentSearchMemory = parsed
      .filter((item) => typeof item === "string" && item.trim())
      .slice(0, RECENT_SEARCH_LIMIT);
    return recentSearchMemory;
  } catch {
    return recentSearchMemory;
  }
}

function writeRecentSearches(items) {
  recentSearchMemory = items.slice(0, RECENT_SEARCH_LIMIT);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearchMemory));
    }
  } catch {
    // Recent searches are a convenience only; the app keeps working without storage.
  }
}

function updateChipScrollHints() {
  document.querySelectorAll("[data-chip-scroll]").forEach((scroll) => {
    const hint = scroll.parentElement?.querySelector(".chips-scroll-hint");
    if (!hint) return;
    const hasOverflow = scroll.scrollWidth - scroll.clientWidth > 4;
    const atEnd = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 4;
    hint.hidden = !hasOverflow || atEnd;
  });
}

function updateResultsScrollHint() {
  if (!dom.resultsList || !dom.resultsScrollNext) return;
  const hasOverflow = dom.resultsList.scrollWidth - dom.resultsList.clientWidth > 4;
  dom.resultsScrollNext.hidden = !hasOverflow;
}

function getRandomStarterSearches() {
  const choices = [...STARTER_SEARCH_POOL];
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [choices[index], choices[randomIndex]] = [choices[randomIndex], choices[index]];
  }
  return choices;
}

function runStarterSearch(query) {
  dom.searchInput.value = query;
  dom.searchInput.focus();
  rememberSearch(query);
  runSearchNow();
}

function appendStarterSearch(query) {
  const button = document.createElement("button");
  button.className = "chip";
  button.type = "button";
  button.dataset.query = query;
  button.textContent = STARTER_SEARCH_LABELS[query] || query;
  button.addEventListener("click", () => runStarterSearch(query));
  dom.exampleSearchList.append(button);
}

async function renderStarterSearches() {
  if (!dom.exampleSearchList) return;
  dom.exampleSearchList.innerHTML = "";

  const candidates = [...getRandomStarterSearches().slice(0, 12), ...STARTER_SEARCH_FALLBACKS];
  const verified = [];
  const seen = new Set();

  for (const query of candidates) {
    if (seen.has(query) || verified.length >= STARTER_SEARCH_COUNT) continue;
    seen.add(query);
    try {
      const results = await searchEntries(query);
      if (results.length) verified.push(query);
    } catch {
      // An unavailable dictionary backend must not leave a broken starter shortcut behind.
    }
  }

  verified.forEach(appendStarterSearch);
  updateChipScrollHints();
}

function renderRecentSearches() {
  if (!dom.recentSearches || !dom.recentSearchList) return;

  const items = readRecentSearches();
  dom.recentSearches.hidden = items.length === 0;
  dom.recentSearchList.innerHTML = "";

  items.forEach((query) => {
    const button = document.createElement("button");
    button.className = "chip";
    button.type = "button";
    button.textContent = query;
    button.addEventListener("click", () => {
      dom.searchInput.value = query;
      dom.searchInput.focus();
      rememberSearch(query);
      updateSearch();
    });
    dom.recentSearchList.append(button);
  });
  updateChipScrollHints();
}

function rememberSearch(query) {
  const value = query.trim();
  if (!value) return;

  const normalized = value.toLocaleLowerCase("fr-FR");
  const next = [
    value,
    ...readRecentSearches().filter((item) => item.toLocaleLowerCase("fr-FR") !== normalized),
  ].slice(0, RECENT_SEARCH_LIMIT);

  writeRecentSearches(next);
  renderRecentSearches();
}

function clearRecentSearches() {
  writeRecentSearches([]);
  renderRecentSearches();
}

function readFavorites() {
  try {
    if (typeof localStorage === "undefined") return favoriteMemory;
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return favoriteMemory;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return favoriteMemory;
    favoriteMemory = parsed
      .map(normalizeFavoriteItem)
      .filter(Boolean)
      .slice(0, FAVORITE_LIMIT);
    return favoriteMemory;
  } catch {
    return favoriteMemory;
  }
}

function normalizeFavoriteItem(item) {
  if (!item || typeof item !== "object") return null;
  const validId = typeof item.id === "number" && Number.isSafeInteger(item.id) && item.id > 0;
  if (!validId || typeof item.headword !== "string") return null;

  const headword = item.headword.trim();
  if (!headword || headword.length > FAVORITE_HEADWORD_MAX_LENGTH) return null;

  const translations = Array.isArray(item.translations)
    ? item.translations
      .filter((translation) => typeof translation === "string")
      .map((translation) => translation.trim())
      .filter((translation) => translation && translation.length <= FAVORITE_TRANSLATION_MAX_LENGTH)
      .slice(0, FAVORITE_TRANSLATION_LIMIT)
    : [];

  return { id: item.id, headword, translations };
}

function writeFavorites(items) {
  const seen = new Set();
  favoriteMemory = items
    .map(normalizeFavoriteItem)
    .filter(Boolean)
    .filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return item.headword;
    })
    .slice(0, FAVORITE_LIMIT);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteMemory));
    }
  } catch {
    // Favorites remain available for the current session when storage is blocked.
  }
}

function isFavorite(entryId) {
  return readFavorites().some((item) => String(item.id) === String(entryId));
}

function renderFavorites() {
  if (!dom.favoriteSearches || !dom.favoriteSearchList) return;

  const items = readFavorites();
  dom.favoriteSearches.hidden = items.length === 0;
  dom.favoriteSearchList.innerHTML = "";

  items.forEach((favorite) => {
    const button = document.createElement("button");
    button.className = "chip favorite-chip";
    button.type = "button";
    button.textContent = favorite.headword;
    button.title = favorite.translations?.length ? favorite.translations.join(", ") : favorite.headword;
    button.addEventListener("click", () => {
      dom.searchInput.value = favorite.headword;
      dom.searchInput.focus();
      rememberSearch(favorite.headword);
      updateSearch();
    });
    dom.favoriteSearchList.append(button);
  });
  updateChipScrollHints();
}

function toggleFavorite(entry) {
  if (!entry) return;

  const entryId = String(entry.id);
  const existing = readFavorites();
  const alreadyFavorite = existing.some((item) => String(item.id) === entryId);

  if (alreadyFavorite) {
    writeFavorites(existing.filter((item) => String(item.id) !== entryId));
  } else {
    writeFavorites([
      {
        id: entry.id,
        headword: entry.headword,
        translations: entry.translations || [],
      },
      ...existing,
    ]);
  }

  renderFavorites();
  updateFavoriteButton(entry.id);
}

function setGlobalStatus(message) {
  if (dom.resultSummary) dom.resultSummary.textContent = message;
}

function exportFavorites() {
  const items = readFavorites();
  const payload = {
    app: "FRAGE",
    type: "favorites",
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "frage-favorites.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setGlobalStatus(`${items.length} favori dışa aktarıldı.`);
}

function validateFavoriteImport(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Favori dosyası FRAGE JSON biçiminde olmalı.");
  }
  if (payload.app !== "FRAGE" || payload.type !== "favorites" || payload.version !== 1 || !Array.isArray(payload.favorites)) {
    throw new Error("Bu dosya geçerli bir FRAGE favori yedeği değil.");
  }
  if (payload.favorites.length > FAVORITE_LIMIT) {
    throw new Error(`Favori dosyası en fazla ${FAVORITE_LIMIT} kayıt içerebilir.`);
  }

  const favorites = payload.favorites.map(normalizeFavoriteItem);
  if (favorites.some((favorite) => !favorite)) {
    throw new Error("Favori dosyasında geçersiz veya aşırı uzun bir kayıt var.");
  }
  return favorites;
}

function validateFavoriteImportFile(file) {
  const name = String(file?.name || "").toLocaleLowerCase("en-US");
  if (!name.endsWith(".json") || !FAVORITE_IMPORT_MIME_TYPES.has(file.type || "")) {
    throw new Error("Yalnızca JSON biçimindeki favori yedekleri içe aktarılabilir.");
  }
  if (!file.size || file.size > FAVORITE_IMPORT_MAX_BYTES) {
    throw new Error("Favori dosyası boş veya izin verilen boyuttan büyük.");
  }
}

function importFavoritesFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Favori dosyası geçerli JSON içermiyor.");
  }

  const imported = validateFavoriteImport(parsed);
  writeFavorites([...imported, ...readFavorites()]);
  renderFavorites();
  updateFavoriteButton(currentEntry?.id);
  setGlobalStatus(`${readFavorites().length} favori hazır.`);
}

function clearFavorites() {
  writeFavorites([]);
  renderFavorites();
  updateFavoriteButton(currentEntry?.id);
}

function updateFavoriteButton(entryId) {
  const button = dom.entryDetail?.querySelector("[data-favorite-entry]");
  if (!button || typeof entryId === "undefined") return;

  const active = isFavorite(entryId);
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.setAttribute("aria-label", active ? "Favorilerden çıkar" : "Favorilere ekle");
  button.title = active ? "Favorilerden çıkar" : "Favorilere ekle";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSafeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderSourceLink(url) {
  const safeUrl = getSafeSourceUrl(url);
  if (!safeUrl) return escapeHtml(url || "Kaynak URL yok");

  return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeUrl)}</a>`;
}

function getMatchLabel(match) {
  const labels = {
    tam: "Tam eşleşme",
    aksan: "Aksansız eşleşme",
    form: "Çekimli form",
    anlam: "Türkçe anlam",
  };

  return labels[match] || "Yakın eşleşme";
}

function getMatchDescription(entry, result, query) {
  const cleanQuery = query.trim();
  if (!cleanQuery || !result?.match) return "";

  const queryText = escapeHtml(cleanQuery);
  const headword = escapeHtml(entry.headword);

  if (result.match === "form") {
    return `<strong>${queryText}</strong> çekimli form olarak <strong>${headword}</strong> maddesine bağlandı.`;
  }

  if (result.match === "aksan") {
    return `<strong>${queryText}</strong> aksansız aramayla <strong>${headword}</strong> maddesine bağlandı.`;
  }

  if (result.match === "anlam") {
    return `<strong>${queryText}</strong> Türkçe anlamlarda bulundu.`;
  }

  if (result.match === "tam") {
    return `<strong>${headword}</strong> doğrudan eşleşti.`;
  }

  return `<strong>${queryText}</strong> için en yakın sonuç gösteriliyor.`;
}

function setTheme(theme) {
  dom.root.dataset.theme = theme;

  try {
    localStorage.setItem("frage-theme", theme);
  } catch {
    // Theme still applies for the current session when persistence is blocked.
  }

  const icon = dom.themeToggle.querySelector("svg");
  if (icon) {
    icon.outerHTML =
      theme === "dark"
        ? `
        <svg class="icon icon-moon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8a7.2 7.2 0 1 0 11.5 11.5Z" />
        </svg>
      `
        : `
        <svg class="icon icon-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.93 4.93 6.7 6.7M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07 6.7 17.3M17.3 6.7l1.77-1.77" />
        </svg>
      `;
  }
}

function getDisplayPartOfSpeech(pos) {
  const labels = {
    sifat: "s\u0131fat",
    baglac: "ba\u011fla\u00e7",
    unlem: "\u00fcnlem",
    pn: "\u00f6zel isim",
  };
  return labels[pos] || pos || "";
}

function renderSearchLoading() {
  dom.resultSummary.textContent = "Aranıyor...";
  dom.searchInput.removeAttribute("aria-activedescendant");
  dom.resultsList.removeAttribute("aria-activedescendant");
  dom.resultsList.setAttribute("aria-busy", "true");
  dom.resultsList.innerHTML = Array.from({ length: 3 }, () => `
    <div class="result-item result-skeleton" aria-hidden="true">
      <span class="skeleton-line skeleton-title"></span>
      <span class="skeleton-line skeleton-subtitle"></span>
      <span class="skeleton-pill"></span>
    </div>
  `).join("");
}

function renderResults(results) {
  dom.resultsList.removeAttribute("aria-busy");
  dom.resultsList.innerHTML = "";
  dom.resultsList.scrollLeft = 0;
  dom.resultCount.textContent = String(results.length);
  dom.resultSummary.textContent = results.length
    ? `${results.length} sonuç gösteriliyor`
    : "Sonuç bulunamadı";

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-state-content">
        <svg class="empty-state-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M8.5 16c1-1.35 2.17-2 3.5-2s2.5.65 3.5 2" />
        </svg>
        <h2>Kelime bulunamadı.</h2>
        <p>Aksan kullanmadan, kök fiille veya Türkçe anlamla tekrar deneyebilirsin.</p>
      </div>
    `;
    dom.searchInput.removeAttribute("aria-activedescendant");
    dom.resultsList.removeAttribute("aria-activedescendant");
    dom.resultsList.append(empty);
    updateResultsScrollHint();
    return;
  }

  const activeOptionId = `result-option-${results[activeIndex]?.id ?? activeIndex}`;
  dom.searchInput.setAttribute("aria-activedescendant", activeOptionId);
  dom.resultsList.setAttribute("aria-activedescendant", activeOptionId);

  results.forEach((entry, index) => {
    const button = document.createElement("button");
    button.className = `result-item${index === activeIndex ? " is-active" : ""}`;
    button.type = "button";
    button.id = `result-option-${entry.id}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
    button.dataset.entryId = String(entry.id);
    button.innerHTML = `
      <span class="result-main">
        <span class="result-word">${entry.headword}</span>
        <span class="result-translation">${entry.translations.join(", ")}</span>
      </span>
      <span class="result-meta-row">
        <span class="result-meta">${getMatchLabel(entry.match)}</span>
        ${entry.pos ? `<span class="result-pos">${getDisplayPartOfSpeech(entry.pos)}</span>` : ""}
      </span>
    `;
    button.addEventListener("click", () => selectEntry(index, { historyMode: "push" }));
    dom.resultsList.append(button);
  });

  dom.resultsList.querySelector(`#${CSS.escape(activeOptionId)}`)?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });
  requestAnimationFrame(updateResultsScrollHint);
}

function getInitialExampleDisplayMode() {
  try {
    const saved = localStorage.getItem(EXAMPLE_DISPLAY_KEY);
    if (["both", "fr", "tr"].includes(saved)) return saved;
  } catch {
    // The default combined view is used when storage is blocked.
  }

  return "both";
}

function setExampleDisplayMode(mode) {
  const nextMode = ["both", "fr", "tr"].includes(mode) ? mode : "both";
  exampleDisplayMode = nextMode;

  try {
    localStorage.setItem(EXAMPLE_DISPLAY_KEY, nextMode);
  } catch {
    // View preference is non-critical and still applies for the current session.
  }

  const block = dom.entryDetail?.querySelector(".examples-block");
  if (!block) return;

  block.dataset.exampleMode = nextMode;
  block.querySelectorAll("[data-example-view]").forEach((button) => {
    const active = button.dataset.exampleView === nextMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function formatExampleSource(source) {
  if (source === "Tatoeba (French-only)") return "Tatoeba (Frans\u0131zca)";
  if (source === "Wiktionary/Kaikki (French-only)") return "Wiktionary/Kaikki (Frans\u0131zca)";
  if (source === "French Wiktionary (source-free example)") return "French Wiktionary (k\u0131sa \u00f6rnek)";
  return source || "Kaynak belirsiz";
}

let entryActionLayoutFrame = 0;

function updateEntryActionLayout() {
  const head = dom.entryDetail?.querySelector(".entry-head");
  const title = head?.querySelector(".entry-title-row h2");
  const actions = head?.querySelector(".entry-actions");
  if (!head || !title || !actions || !title.firstChild) return;

  head.classList.remove("entry-actions-on-own-row");
  const range = document.createRange();
  range.selectNodeContents(title);
  const actionsRect = actions.getBoundingClientRect();
  const overlapsActions = Array.from(range.getClientRects()).some((rect) => (
    rect.top < actionsRect.bottom &&
    rect.bottom > actionsRect.top &&
    rect.right > actionsRect.left - 12
  ));

  if (overlapsActions) head.classList.add("entry-actions-on-own-row");
}

function scheduleEntryActionLayout() {
  cancelAnimationFrame(entryActionLayoutFrame);
  entryActionLayoutFrame = requestAnimationFrame(updateEntryActionLayout);
}

function renderEntry(entry, result = null, query = "") {
  dom.emptyState.hidden = true;
  dom.entryDetail.hidden = false;
  currentEntry = entry;
  currentSpokenWord = entry.headword;
  const matchDescription = getMatchDescription(entry, result, query);
  const matchContext = matchDescription
    ? `<div class="match-context"><span>${getMatchLabel(result.match)}</span><p>${matchDescription}</p></div>`
    : "";

  const senses = entry.senses
    .map(
      (sense, index) => `
        <section class="sense-card">
          <div class="sense-top">
            <span class="sense-number">${index + 1}</span>
            ${
              sense.machineTranslated
                ? '<span class="source-tag">otomatik \u00e7eviri</span>'
                : sense.generatedFromTranslations
                  ? '<span class="source-tag">\u00e7eviri \u00f6zeti</span>'
                  : '<span class="source-tag">do\u011frulanm\u0131\u015f</span>'
            }
          </div>
          <p class="sense-definition">${sense.definition}</p>
          <p class="sense-original">${sense.original}</p>
        </section>
      `,
    )
    .join("");

  const examples = entry.examples.length
    ? [...entry.examples]
        .sort((left, right) => Number(Boolean(right.tr)) - Number(Boolean(left.tr)))
        .map(
          (example) => `
            <div class="example${!example.tr && example.machineTranslation ? " is-machine" : ""}">
              <p class="example-fr">${example.fr}</p>
              <p class="example-tr">${example.tr || (example.machineTranslation ? "" : "T\u00fcrk\u00e7e \u00e7evirisi kaynakta yok.")}</p>
              ${!example.tr && example.machineTranslation ? `<button class="example-translation-button" type="button" data-machine-translation="${escapeHtml(example.machineTranslation)}">Otomatik \u00c7evir</button>` : ""}
              <div class="example-footer">
                <span class="example-source">${formatExampleSource(example.source)}</span>
                <span class="example-quality${!example.tr && example.machineTranslation ? " is-machine" : ""}">${!example.tr && example.machineTranslation ? "İsteğe bağlı çeviri" : "T\u00fcrk\u00e7e kaynak"}</span>
              </div>
            </div>
          `,
        )
        .join("")
    : '<p class="muted-note">Bu madde için örnek cümle henüz yok.</p>';

  const formGroups = new Map();
  const formLabel = (type) => {
    const tags = String(type || "").split(",");
    if (tags.includes("infinitive")) return "Mastar";
    if (tags.includes("gerund")) return "Ula\u00e7";
    if (tags.includes("participle")) return "Orta\u00e7";
    if (tags.includes("conditional")) return "Ko\u015ful kipi";
    if (tags.includes("future")) return "Gelecek zaman";
    if (tags.includes("imperfect")) return "Hik\u00e2ye ge\u00e7mi\u015fi";
    if (tags.includes("historic") || tags.includes("past")) return "Ge\u00e7mi\u015f zaman";
    if (tags.includes("present")) return "\u015eimdiki zaman";
    if (tags.includes("imperative")) return "Emir kipi";
    return "Di\u011fer formlar";
  };
  (entry.forms || []).forEach((item) => {
    const form = typeof item === "string" ? item : item.form;
    const type = typeof item === "string" ? "" : item.type;
    if (!form || form === "no-table-tags" || form.includes(" + ") || /^[a-z]{2}-conj-/.test(form)) return;
    const label = formLabel(type);
    const group = formGroups.get(label) || new Map();
    group.set(form, type);
    formGroups.set(label, group);
  });
  const formOrder = ["Mastar", "\u015eimdiki zaman", "Hik\u00e2ye ge\u00e7mi\u015fi", "Ge\u00e7mi\u015f zaman", "Gelecek zaman", "Ko\u015ful kipi", "Emir kipi", "Orta\u00e7", "Ula\u00e7", "Di\u011fer formlar"];
  const forms = [...formGroups.entries()]
    .sort(([left], [right]) => formOrder.indexOf(left) - formOrder.indexOf(right))
    .map(([label, items]) => `<div class="form-group"><h4>${label}<span>${items.size}</span></h4><div class="form-list">${[...items.keys()].map((form) => `<button class="form-chip" type="button" data-form-query="${form}">${form}</button>`).join("")}</div></div>`)
    .join("");


  const formsBlock = forms
    ? `
      <section class="forms-block">
        <h3>Çekimli formlar</h3>
        <div class="form-list">${forms}</div>
      </section>
    `
    : "";

  const sources = entry.sources
    .map((source) => `<span class="source-tag">${source}</span>`)
    .join("");

  dom.entryDetail.innerHTML = `
    <header class="entry-head">
      <div class="entry-actions">
        <button
          class="entry-action-button favorite-button${isFavorite(entry.id) ? " is-active" : ""}"
          type="button"
          aria-label="${isFavorite(entry.id) ? "Favorilerden çıkar" : "Favorilere ekle"}"
          aria-pressed="${isFavorite(entry.id) ? "true" : "false"}"
          title="${isFavorite(entry.id) ? "Favorilerden çıkar" : "Favorilere ekle"}"
          data-favorite-entry="${entry.id}"
        >
          <svg class="icon icon-star" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
          </svg>
        </button>
        <button
          class="entry-action-button copy-button"
          type="button"
          aria-label="Kelime bilgisini kopyala"
          title="Kelime bilgisini kopyala"
          data-copy-entry="${entry.id}"
        >
          <svg class="icon icon-copy" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <rect x="8" y="8" width="10" height="12" rx="2" />
            <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          class="entry-action-button speak-button"
          type="button"
          aria-label="${entry.headword} kelimesini Fransızca seslendir"
          title="Fransızca seslendir"
          data-speak-word="${entry.headword}"
        >
          <svg
            class="icon icon-speaker"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M4.5 9.5h4l5-4v13l-5-4h-4z" />
            <path d="M17 9a4.5 4.5 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
          </svg>
        </button>
      </div>
      <div class="entry-title-row">
        <h2>${entry.headword}</h2>
        <span class="pos-tag">${getDisplayPartOfSpeech(entry.pos)}</span>
      </div>
      <div class="pronunciation">${entry.ipa}</div>
      <p class="translation-line">${entry.translations.join(", ")}</p>
      ${matchContext}
      <p class="speech-status" id="speechStatus" aria-live="polite"></p>
    </header>

    <div class="sense-list">
      ${senses}
    </div>

    ${formsBlock}

    <section class="examples-block" data-example-mode="${exampleDisplayMode}">
      <div class="section-heading-row">
        <h3>Örnek kullanım</h3>
        <div class="segmented-control" aria-label="Örnek görünümü">
          <button class="segment-button${exampleDisplayMode === "both" ? " is-active" : ""}" type="button" data-example-view="both" aria-pressed="${exampleDisplayMode === "both" ? "true" : "false"}">FR + TR</button>
          <button class="segment-button${exampleDisplayMode === "fr" ? " is-active" : ""}" type="button" data-example-view="fr" aria-pressed="${exampleDisplayMode === "fr" ? "true" : "false"}">FR</button>
          <button class="segment-button${exampleDisplayMode === "tr" ? " is-active" : ""}" type="button" data-example-view="tr" aria-pressed="${exampleDisplayMode === "tr" ? "true" : "false"}">TR</button>
        </div>
      </div>
      <div class="example-list">${examples}</div>
    </section>

    <section class="source-block">
      <h3>Kaynaklar</h3>
      <div class="source-tags">${sources}</div>
    </section>
  `;
  scheduleEntryActionLayout();
}

function getFrenchVoice() {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const preferredLangs = ["fr-FR", "fr", "fr-CA", "fr-BE", "fr-CH"];

  return (
    preferredLangs
      .map((lang) => voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()))
      .find(Boolean) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("fr")) ||
    null
  );
}

function setActionStatus(message) {
  const status = document.querySelector("#speechStatus");
  if (status) status.textContent = message;
}

function setSpeechStatus(message) {
  setActionStatus(message);
}

function getEntryCopyText(entry) {
  if (!entry) return "";

  const lines = [
    `${entry.headword} - ${entry.translations.join(", ")}`,
    entry.ipa ? `Telaffuz: ${entry.ipa}` : "",
    entry.senses?.[0]?.definition ? `Açıklama: ${entry.senses[0].definition}` : "",
    entry.examples?.[0] ? `Örnek: ${entry.examples[0].fr} / ${entry.examples[0].tr}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

async function copyTextToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    textarea.remove();
    return false;
  }
}

async function copyCurrentEntry() {
  const copied = await copyTextToClipboard(getEntryCopyText(currentEntry));
  const button = dom.entryDetail?.querySelector("[data-copy-entry]");

  if (copied) {
    button?.classList.add("is-copied");
    setActionStatus("Kelime bilgisi kopyalandı.");
    window.setTimeout(() => button?.classList.remove("is-copied"), 900);
    window.setTimeout(() => setActionStatus(""), 1800);
    return;
  }

  setActionStatus("Kopyalama desteklenmiyor.");
}

function speakFrenchWord(word) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    setSpeechStatus("Bu tarayıcı telaffuz özelliğini desteklemiyor.");
    return;
  }

  const voice = getFrenchVoice();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = voice?.lang || "fr-FR";
  if (voice) utterance.voice = voice;
  utterance.rate = 0.86;
  utterance.pitch = 1;

  utterance.onstart = () => setSpeechStatus("Telaffuz oynatılıyor...");
  utterance.onend = () => setSpeechStatus("");
  utterance.onerror = () => setSpeechStatus("Telaffuz oynatılamadı.");

  // Let the browser choose fr-FR immediately if its voice list is still loading.
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  setSpeechStatus("Telaffuz oynatılıyor...");
  window.speechSynthesis.speak(utterance);
}

async function selectEntry(index, options = {}) {
  if (!currentResults.length) return;
  activeIndex = Math.max(0, Math.min(index, currentResults.length - 1));
  renderResults(currentResults);

  try {
    const result = currentResults[activeIndex];
    syncSearchUrl(dom.searchInput.value, result.id, options.historyMode || "replace");
    const entry = await getEntry(result.id);
    if (entry) renderEntry(entry, result, dom.searchInput.value);
  } catch (error) {
    dom.resultSummary.textContent = error.message;
  }
}

function getUrlSearchState() {
  try {
    const url = new URL(window.location.href);
    return {
      query: url.searchParams.get("q") || "",
      entryId: url.searchParams.get("entry") || "",
    };
  } catch {
    return { query: "", entryId: "" };
  }
}

function syncSearchUrl(query, entryId = "", mode = "replace") {
  if (mode === "none" || !window.history?.replaceState) return;

  try {
    const url = new URL(window.location.href);
    const normalizedQuery = String(query || "").trim();
    if (normalizedQuery) url.searchParams.set("q", normalizedQuery);
    else url.searchParams.delete("q");
    if (normalizedQuery && entryId) url.searchParams.set("entry", String(entryId));
    else url.searchParams.delete("entry");

    if (url.href === window.location.href) return;
    const state = { frageQuery: normalizedQuery, frageEntryId: entryId ? String(entryId) : "" };
    if (mode === "push") window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
  } catch {
    // Search works normally in file previews and restricted browser contexts.
  }
}

async function updateSearch(options = {}) {
  const runId = ++searchRunId;
  const query = dom.searchInput.value;
  const normalizedQuery = query.trim();
  activeIndex = 0;
  dom.clearButton.hidden = query.length === 0;

  if (!normalizedQuery) {
    currentResults = [];
    dom.resultsList.removeAttribute("aria-busy");
    dom.resultsList.innerHTML = "";
    dom.resultCount.textContent = "0";
    dom.resultSummary.textContent = "Aramak istediğin kelimeyi yaz.";
    dom.searchInput.removeAttribute("aria-activedescendant");
    dom.resultsList.removeAttribute("aria-activedescendant");
    dom.resultsStrip.hidden = true;
    dom.emptyState.hidden = false;
    dom.entryDetail.hidden = true;
    syncSearchUrl("", "", options.historyMode || "replace");
    return;
  }

  dom.resultsStrip.hidden = false;
  renderSearchLoading();

  try {
    const results = await searchEntries(query);
    if (runId !== searchRunId) return;

    currentResults = results;
    const requestedIndex = currentResults.findIndex((item) => String(item.id) === String(options.entryId || ""));
    activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
    renderResults(currentResults);

    if (currentResults.length) {
      const result = currentResults[activeIndex];
      syncSearchUrl(query, result.id, options.historyMode || "replace");
      const entry = await getEntry(result.id);
      if (runId === searchRunId && entry) renderEntry(entry, result, query);
      return;
    }

    syncSearchUrl(query, "", options.historyMode || "replace");
    dom.emptyState.hidden = true;
    dom.entryDetail.hidden = true;
  } catch (error) {
    if (runId !== searchRunId) return;
    currentResults = [];
    renderResults(currentResults);
    dom.resultSummary.textContent = error.message;
  }
}

function scheduleSearch() {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = null;
    updateSearch();
  }, SEARCH_DEBOUNCE_MS);
}

function runSearchNow(options = {}) {
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }

  return updateSearch(options);
}


function setupResultsScrollDrag() {
  if (!dom.resultsList) return;

  let dragState = null;
  let suppressNextClick = false;
  let suppressTimer = null;

  const markNextClickAsSuppressed = () => {
    suppressNextClick = true;
    window.clearTimeout(suppressTimer);
    suppressTimer = window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  };

  dom.resultsList.addEventListener("click", (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  dom.resultsList.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: dom.resultsList.scrollLeft,
      moved: false,
    };
  });

  dom.resultsList.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const distance = event.clientX - dragState.startX;
    const verticalDistance = event.clientY - dragState.startY;

    if (!dragState.moved) {
      if (Math.abs(distance) < 8 || Math.abs(distance) <= Math.abs(verticalDistance)) return;
      dragState.moved = true;

      if (dragState.pointerType !== "touch") {
        dom.resultsList.classList.add("is-dragging");
        dom.resultsList.setPointerCapture?.(event.pointerId);
      }
    }

    // Touch devices keep their native momentum scrolling. Mouse dragging is
    // controlled here so desktop users can drag the same horizontal list.
    if (dragState.pointerType !== "touch") {
      dom.resultsList.scrollLeft = dragState.startLeft - distance;
      event.preventDefault();
    }
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const moved = dragState.moved;
    const pointerType = dragState.pointerType;
    if (dom.resultsList.hasPointerCapture?.(event.pointerId)) {
      dom.resultsList.releasePointerCapture(event.pointerId);
    }
    dragState = null;

    // Native touch scrolling already cancels its own click. Suppressing the
    // next click here could reject a legitimate tap with slight finger drift.
    if (moved && pointerType !== "touch") {
      markNextClickAsSuppressed();
      window.setTimeout(() => dom.resultsList.classList.remove("is-dragging"), 0);
    } else {
      dom.resultsList.classList.remove("is-dragging");
    }
  };

  dom.resultsList.addEventListener("pointerup", finishDrag);
  dom.resultsList.addEventListener("pointercancel", finishDrag);
}

function setupChipScrollHints() {
  const refresh = () => {
    updateChipScrollHints();
    updateResultsScrollHint();
  };

  document.querySelectorAll("[data-chip-scroll]").forEach((scroll) => {
    let dragState = null;

    scroll.addEventListener("scroll", refresh, { passive: true });
    scroll.addEventListener("pointerdown", (event) => {
      // Touch keeps its native horizontal scroll. Mouse drag can begin on a word
      // without changing a short click into a lost search action.
      if (event.pointerType === "touch" || event.button !== 0) return;
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: scroll.scrollLeft,
        moved: false,
      };
    });

    scroll.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const distance = event.clientX - dragState.startX;
      const verticalDistance = event.clientY - dragState.startY;
      if (!dragState.moved) {
        if (Math.abs(distance) < 8 || Math.abs(distance) <= Math.abs(verticalDistance)) return;
        dragState.moved = true;
        scroll.classList.add("is-dragging");
        scroll.setPointerCapture?.(event.pointerId);
      }
      scroll.scrollLeft = dragState.startLeft - distance;
      event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const moved = dragState.moved;
      if (scroll.hasPointerCapture?.(event.pointerId)) scroll.releasePointerCapture(event.pointerId);
      dragState = null;
      if (moved) {
        window.setTimeout(() => scroll.classList.remove("is-dragging"), 0);
      } else {
        scroll.classList.remove("is-dragging");
      }
      refresh();
    };

    scroll.addEventListener("pointerup", finishDrag);
    scroll.addEventListener("pointercancel", finishDrag);

    scroll.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (scroll.scrollWidth <= scroll.clientWidth) return;
      scroll.scrollLeft += event.deltaY;
      event.preventDefault();
    }, { passive: false });
  });

  document.querySelectorAll("[data-chip-scroll-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const scroll = button.parentElement?.querySelector("[data-chip-scroll]");
      if (!scroll) return;
      scroll.scrollBy({ left: Math.max(120, Math.round(scroll.clientWidth * 0.72)), behavior: "smooth" });
    });
  });

  dom.resultsList?.addEventListener("scroll", refresh, { passive: true });
  dom.resultsScrollNext?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dom.resultsList.scrollBy({ left: Math.max(180, Math.round(dom.resultsList.clientWidth * 0.8)), behavior: "smooth" });
  });

  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("resize", scheduleEntryActionLayout, { passive: true });
  refresh();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=79", { updateViaCache: "none" }).catch(() => {
      // The app remains fully usable without service worker support.
    });
  }, { once: true });
}

async function updateDataStatus() {
  if (!dom.dataStatus) return;

  try {
    const status = await getDataStatus();
    if (status.sqliteReady) {
      const isSharded = status.mode === "sharded";
      dom.dataStatus.textContent = "Sözlük hazır";
      if (dom.dataStatusPill) {
        dom.dataStatusPill.title = "Sözlük verisi aramaya hazır.";
      }
    } else if (status.mode === "file") {
      dom.dataStatus.textContent = "Sözlük hazır";
      if (dom.dataStatusPill) {
        dom.dataStatusPill.title = "file:// modunda tarayıcı SQLite WASM dosyalarını engelleyebilir; JS fallback kullanılıyor.";
      }
    } else {
      dom.dataStatus.textContent = "Sözlük hazır";
      if (dom.dataStatusPill) {
        dom.dataStatusPill.title = "SQLite açılamadığı için JS fallback kullanılıyor.";
      }
    }
  } catch {
    dom.dataStatus.textContent = "Veri hazır";
  }
}

function getModalFocusableElements() {
  return [...dom.sourceModal.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hidden && element.offsetParent !== null);
}

function trapModalFocus(event) {
  if (dom.sourceModal.hidden || event.key !== "Tab") return;

  const focusable = getModalFocusableElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openSources() {
  previousFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dom.modalBackdrop.hidden = false;
  dom.sourceModal.hidden = false;
  dom.closeSourcesButton.focus();
}

function closeSources() {
  dom.modalBackdrop.hidden = true;
  dom.sourceModal.hidden = true;

  const target = previousFocusTarget?.isConnected ? previousFocusTarget : dom.sourcesButton;
  previousFocusTarget = null;
  target.focus();
}

async function loadAttributions() {
  if (!window.fetch) return;

  try {
    const attributionsResponse = await fetch("data/attributions.json?v=13");
    if (!attributionsResponse.ok) return;

    const attributions = await attributionsResponse.json();
    const sourceList = document.querySelector(".source-list");
    if (!sourceList) return;

    sourceList.innerHTML = attributions.sources
      .map(
        (source) => `
          <article>
            <h3>${escapeHtml(source.name)}</h3>
            <p>${escapeHtml(source.usage)}. Lisans: ${escapeHtml(source.license)}. Kaynak: ${renderSourceLink(source.url)}</p>
          </article>
        `
      )
      .join("");
  } catch {
    // Static fallback content stays visible when JSON fetch is unavailable.
  }
}

dom.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearchNow({ historyMode: "push" });
  if (currentResults.length) rememberSearch(dom.searchInput.value);
});

dom.searchInput.addEventListener("input", scheduleSearch);

dom.searchInput.addEventListener("keydown", (event) => {
  if (!currentResults.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectEntry(activeIndex + 1);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectEntry(activeIndex - 1);
  }

  if (event.key === "Home") {
    event.preventDefault();
    selectEntry(0);
  }

  if (event.key === "End") {
    event.preventDefault();
    selectEntry(currentResults.length - 1);
  }
});

dom.clearButton.addEventListener("click", () => {
  dom.searchInput.value = "";
  dom.searchInput.focus();
  runSearchNow();
});

dom.entryDetail.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite-entry]");
  if (favoriteButton) {
    toggleFavorite(currentEntry);
    return;
  }

  const copyButton = event.target.closest("[data-copy-entry]");
  if (copyButton) {
    copyCurrentEntry();
    return;
  }

  const machineTranslationButton = event.target.closest("[data-machine-translation]");
  if (machineTranslationButton) {
    const example = machineTranslationButton.closest(".example");
    const translation = machineTranslationButton.dataset.machineTranslation || "";
    const line = example?.querySelector(".example-tr");
    if (line) line.textContent = translation;
    machineTranslationButton.setAttribute("aria-expanded", "true");
    machineTranslationButton.insertAdjacentHTML("afterend", '<p class="example-machine-note">Otomatik olarak makine \u00e7evirisiyle olu\u015fturulmu\u015ftur. Hatal\u0131 olabilir.</p>');
    machineTranslationButton.remove();
    return;
  }

  const exampleModeButton = event.target.closest("[data-example-view]");
  if (exampleModeButton) {
    setExampleDisplayMode(exampleModeButton.dataset.exampleView);
    return;
  }

  const formButton = event.target.closest("[data-form-query]");
  if (formButton) {
    dom.searchInput.value = formButton.dataset.formQuery || "";
    dom.searchInput.focus();
    rememberSearch(dom.searchInput.value);
    runSearchNow();
    return;
  }

  const button = event.target.closest("[data-speak-word]");
  if (!button) return;
  speakFrenchWord(button.dataset.speakWord || currentSpokenWord);
});

if (dom.clearRecentSearches) {
  dom.clearRecentSearches.addEventListener("click", () => {
    clearRecentSearches();
    dom.searchInput.focus();
  });
}

if (dom.exportFavorites) {
  dom.exportFavorites.addEventListener("click", () => {
    exportFavorites();
    dom.searchInput.focus();
  });
}

if (dom.importFavorites && dom.favoriteImportInput) {
  dom.importFavorites.addEventListener("click", () => {
    dom.favoriteImportInput.click();
  });

  dom.favoriteImportInput.addEventListener("change", async () => {
    const [file] = dom.favoriteImportInput.files || [];
    dom.favoriteImportInput.value = "";
    if (!file) return;

    try {
      validateFavoriteImportFile(file);
      importFavoritesFromText(await file.text());
    } catch (error) {
      setGlobalStatus(error.message || "Favoriler içe aktarılamadı.");
    }
    dom.searchInput.focus();
  });
}

if (dom.clearFavorites) {
  dom.clearFavorites.addEventListener("click", () => {
    clearFavorites();
    dom.searchInput.focus();
  });
}

dom.themeToggle.addEventListener("click", () => {
  const nextTheme = dom.root.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
});

dom.sourcesButton.addEventListener("click", openSources);
dom.closeSourcesButton.addEventListener("click", closeSources);
dom.modalBackdrop.addEventListener("click", closeSources);

document.addEventListener("keydown", (event) => {
  trapModalFocus(event);

  const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
  if (isSearchShortcut) {
    event.preventDefault();
    dom.searchInput.focus();
  }

  if (event.key === "Escape") {
    if (!dom.sourceModal.hidden) {
      closeSources();
      return;
    }

    if (document.activeElement === dom.searchInput && dom.searchInput.value) {
      dom.searchInput.value = "";
      runSearchNow();
    }
  }
});

function initApp() {
  if (appInitialized) return;
  dom.resultSummary?.setAttribute("aria-live", "polite");
  dom.resultSummary?.setAttribute("aria-atomic", "true");
  appInitialized = true;
  setTheme(getInitialTheme());
  exampleDisplayMode = getInitialExampleDisplayMode();
  renderStarterSearches();
  renderRecentSearches();
  renderFavorites();
  setupResultsScrollDrag();
  setupChipScrollHints();
  const initialSearchState = getUrlSearchState();
  if (initialSearchState.query) dom.searchInput.value = initialSearchState.query;
  runSearchNow({ historyMode: "none", entryId: initialSearchState.entryId });
  updateDataStatus();
  loadAttributions();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

window.addEventListener("popstate", () => {
  const state = getUrlSearchState();
  dom.searchInput.value = state.query;
  runSearchNow({ historyMode: "none", entryId: state.entryId });
});

setTimeout(initApp, 0);
