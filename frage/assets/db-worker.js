let sqliteReady = false;
let sqliteError = null;
let sqliteModule = null;
let storageMode = "fallback";
let coreDb = null;
let formsDb = null;
let examplesDb = null;
let sqliteEntries = [];
let sqliteSenses = [];
let sqliteForms = [];
let sqliteExamples = [];
let shardManifest = null;
const shardCache = new Map();
const indexCache = new Map();
const entryShardById = new Map();

importScripts(
  "../data/core.js?v=14",
  "../data/forms.js?v=14",
  "../data/examples.js?v=14",
  "mock-data.js?v=12"
);

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr")
    .replace(/\u0131/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s'\u2019`\u00b4\u02bc-]/g, "")
    .trim();
}

function getQueryVariants(query, rawQuery = "") {
  const variants = new Set([query]);
  const elision = String(rawQuery || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .match(/^(?:qu|l|d|j|m|t|s|n|c)['\u2019](.+)$/);
  if (elision?.[1]?.length > 1) variants.add(normalize(elision[1]));
  return [...variants].filter(Boolean);
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load ${path}`);
  return response.json();
}

function rowsFromResult(result) {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
}

function readRows(db, sql, params = []) {
  return rowsFromResult(db.exec(sql, params));
}

function parseJsonArray(value) {
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function hydrateFullCache() {
  sqliteEntries = readRows(coreDb, "SELECT id, headword, normalized_headword AS normalized, pos, ipa, match_type AS match, translations_json, sources_json FROM entries ORDER BY id")
    .map((entry) => ({ ...entry, translations: parseJsonArray(entry.translations_json), sources: parseJsonArray(entry.sources_json) }));
  sqliteSenses = readRows(coreDb, 'SELECT id, entry_id AS entryId, sense_order AS "order", definition_tr AS definition, definition_original AS original, machine_translated AS machineTranslated FROM senses ORDER BY entry_id, sense_order')
    .map((sense) => ({ ...sense, machineTranslated: Boolean(sense.machineTranslated), generatedFromTranslations: Boolean(sense.generatedFromTranslations) }));
  sqliteForms = readRows(formsDb, "SELECT id, entry_id AS entryId, form, normalized_form AS normalized, form_type AS type FROM forms ORDER BY id");
}

async function initSqlite() {
  try {
    importScripts("../vendor/sql-wasm.js?v=10");
    sqliteModule = await initSqlJs({ locateFile: (file) => `../vendor/${file}` });
    try {
      shardManifest = await fetchJson("../data/shards/manifest.json?v=20260621-1");
      if (shardManifest?.format === "frage-sharded-sqlite-v1") {
        storageMode = "sharded";
        sqliteReady = true;
        return;
      }
    } catch {
      shardManifest = null;
    }
    const [coreBytes, formsBytes] = await Promise.all([
      fetchBytes("../data/core.sqlite?v=14"),
      fetchBytes("../data/forms.sqlite?v=14"),
    ]);
    coreDb = new sqliteModule.Database(coreBytes);
    formsDb = new sqliteModule.Database(formsBytes);
    hydrateFullCache();
    storageMode = "full";
    sqliteReady = true;
  } catch (error) {
    sqliteError = error;
    sqliteReady = false;
  }
}

const sqliteInit = initSqlite();

function getEntryForms(entryId) { return sqliteForms.filter((form) => form.entryId === entryId); }
function getEntrySenses(entryId) { return sqliteSenses.filter((sense) => sense.entryId === entryId); }

async function ensureFullExamples() {
  if (examplesDb) return;
  examplesDb = new sqliteModule.Database(await fetchBytes("../data/examples.sqlite?v=14"));
  sqliteExamples = readRows(examplesDb, "SELECT id, entry_id AS entryId, sense_id AS senseId, fr_text AS fr, tr_text AS tr, source FROM examples ORDER BY id");
}

function getMatchType(entry, query) {
  const variants = getQueryVariants(query);
  if (variants.includes(entry.normalized)) return entry.headword === query ? "tam" : "aksan";
  if (getEntryForms(entry.id).some((form) => variants.includes(normalize(form.form)))) return "form";
  if (entry.translations.some((item) => variants.some((variant) => normalize(item).includes(variant)))) return "anlam";
  return entry.match;
}

function compareSearchResults(left, right) {
  const scoreDifference = right.score - left.score;
  if (scoreDifference) return scoreDifference;
  const fragmentDifference = Number(left.headword.startsWith("-")) - Number(right.headword.startsWith("-"));
  if (fragmentDifference) return fragmentDifference;
  return left.headword.localeCompare(right.headword);
}

function toSummary(entry) {
  return { id: entry.id, headword: entry.headword, pos: entry.pos, translations: entry.translations, match: entry.match };
}

function searchFull(queryText) {
  const query = normalize(queryText);
  if (!query) return sqliteEntries.map(toSummary);
  return sqliteEntries.map((entry) => {
    const forms = getEntryForms(entry.id);
    const senses = getEntrySenses(entry.id);
    const haystack = [entry.headword, entry.normalized, ...forms.map((item) => item.form), ...entry.translations, ...senses.map((item) => item.definition)].map(normalize).join(" ");
    const variants = getQueryVariants(query);
    const score = Math.max(
      variants.includes(entry.normalized) ? 100 : 0,
      entry.translations.some((translation) => variants.includes(normalize(translation))) ? 95 : 0,
      forms.some((item) => variants.includes(normalize(item.form))) ? 80 : 0,
      variants.some((item) => entry.normalized.startsWith(item)) ? 60 : 0,
      variants.some((item) => haystack.includes(item)) ? 40 : 0
    );
    return { ...toSummary(entry), match: getMatchType(entry, query), score };
  }).filter((entry) => entry.score > 0).sort(compareSearchResults);
}

function editDistanceWithin(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let minimum = current[0];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current.push(value);
      minimum = Math.min(minimum, value);
    }
    if (minimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

function indexBucket(value) {
  const first = normalize(value).charAt(0);
  return /^[a-z0-9]$/.test(first) ? first : "_";
}

async function loadIndex(bucket) {
  if (indexCache.has(bucket)) return indexCache.get(bucket);
  const promise = fetchJson(`../data/${shardManifest.indexDirectory}/${bucket}.json?v=20260621-1`).catch(() => ({ terms: {} }));
  indexCache.set(bucket, promise);
  return promise;
}

async function searchSharded(queryText) {
  const query = normalize(queryText);
  if (!query) return [];
  const variants = getQueryVariants(query, queryText);
  const indexes = await Promise.all(variants.map((variant) => loadIndex(indexBucket(variant))));
  const candidates = new Map();
  indexes.forEach((index, indexPosition) => {
    const variant = variants[indexPosition];
    Object.entries(index.terms || {}).forEach(([term, records]) => {
      if (!term.startsWith(variant)) return;
      records.forEach((record) => {
        const existing = candidates.get(record.id);
        const exact = term === variant;
        const exactTranslation = record.kind === "translation" && record.translations?.some((translation) => normalize(translation) === variant);
        const score = record.kind === "headword"
          ? (exact ? 100 : 60)
          : record.kind === "form"
            ? (exact ? 80 : 55)
            : (exactTranslation ? 95 : (exact ? 70 : 45));
        const match = record.kind === "form" ? "form" : record.kind === "translation" ? "anlam" : (exact ? "tam" : "aksan");
        const candidate = { ...record, score, match };
        if (!existing || candidate.score > existing.score) candidates.set(record.id, candidate);
        entryShardById.set(String(record.id), record.shard);
      });
    });
  });
  if (!candidates.size && query.length >= 4) {
    indexes.forEach((index) => {
      Object.entries(index.terms || {}).forEach(([term, records]) => {
        if (editDistanceWithin(query, term, 1) > 1) return;
        records.forEach((record) => {
          const existing = candidates.get(record.id);
          const candidate = { ...record, score: 25, match: "yakin" };
          if (!existing || candidate.score > existing.score) candidates.set(record.id, candidate);
          entryShardById.set(String(record.id), record.shard);
        });
      });
    });
  }

  return [...candidates.values()]
    .sort(compareSearchResults)
    .slice(0, 80)
    .map(({ shard, normalized, kind, score, ...summary }) => summary);
}

async function ensureShard(shard) {
  if (!shard) return null;
  if (shardCache.has(shard)) return shardCache.get(shard);
  const promise = fetchBytes(`../data/${shardManifest.shardDirectory}/${shard}.sqlite?v=20260621-1`).then((bytes) => new sqliteModule.Database(bytes));
  shardCache.set(shard, promise);
  return promise;
}

function mapShardEntry(db, entryId) {
  const entry = readRows(db, "SELECT id, headword, normalized_headword AS normalized, pos, ipa, match_type AS match, translations_json, sources_json FROM entries WHERE id = ?", [entryId])[0];
  if (!entry) return null;
  const senses = readRows(db, 'SELECT id, entry_id AS entryId, sense_order AS "order", definition_tr AS definition, definition_original AS original, machine_translated AS machineTranslated, generated_from_translations AS generatedFromTranslations FROM senses WHERE entry_id = ? ORDER BY sense_order', [entryId])
    .map((sense) => ({ ...sense, machineTranslated: Boolean(sense.machineTranslated), generatedFromTranslations: Boolean(sense.generatedFromTranslations) }));
  const forms = readRows(db, "SELECT form, form_type AS type FROM forms WHERE entry_id = ? ORDER BY id", [entryId]);
  const examples = readRows(db, "SELECT fr_text AS fr, tr_text AS tr, machine_translation_text AS machineTranslation, source FROM examples WHERE entry_id = ? ORDER BY id", [entryId]);
  return { ...entry, translations: parseJsonArray(entry.translations_json), sources: parseJsonArray(entry.sources_json), senses, forms, examples };
}

async function getSqliteEntry(entryId) {
  if (storageMode === "sharded") {
    const shard = entryShardById.get(String(entryId));
    const db = await ensureShard(shard);
    return db ? mapShardEntry(db, entryId) : null;
  }
  const entry = sqliteEntries.find((item) => String(item.id) === String(entryId));
  if (!entry) return null;
  await ensureFullExamples();
  return { ...entry, forms: getEntryForms(entry.id).map((form) => form.form), senses: getEntrySenses(entry.id), examples: sqliteExamples.filter((item) => item.entryId === entry.id).map(({ fr, tr, source }) => ({ fr, tr, source })) };
}

async function handleMessage(event) {
  const { id, type, payload } = event.data;
  try {
    await sqliteInit;
    const source = sqliteReady ? "sqlite" : "js";
    if (type === "SEARCH") {
      const query = payload?.query || "";
      self.postMessage({ id, ok: true, type, source, payload: sqliteReady ? (storageMode === "sharded" ? await searchSharded(query) : searchFull(query)) : self.FRAGE_DATA.searchEntries(query) });
      return;
    }
    if (type === "GET_ENTRY") {
      self.postMessage({ id, ok: true, type, source, payload: sqliteReady ? await getSqliteEntry(payload?.entryId) : self.FRAGE_DATA.getEntry(payload?.entryId) });
      return;
    }
    if (type === "STATUS") {
      self.postMessage({ id, ok: true, type, payload: { source, sqliteReady, sqliteError: sqliteError?.message || null, mode: storageMode, packages: { core: sqliteReady, forms: sqliteReady, examples: storageMode === "sharded" ? true : Boolean(examplesDb) } } });
      return;
    }
    throw new Error(`Unknown worker message type: ${type}`);
  } catch (error) {
    self.postMessage({ id, ok: false, type, error: error.message || "Worker error" });
  }
}

self.addEventListener("message", (event) => handleMessage(event));
