(function attachDataAdapter(globalScope) {
  const core = globalScope.FRAGE_CORE || { entries: [], senses: [] };
  const forms = globalScope.FRAGE_FORMS || [];
  const examples = globalScope.FRAGE_EXAMPLES || [];

  function normalize(value) {
    return value
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

  function getEntryForms(entryId) {
    return forms.filter((form) => form.entryId === entryId);
  }

  function getEntrySenses(entryId) {
    return core.senses
      .filter((sense) => sense.entryId === entryId)
      .sort((a, b) => a.order - b.order)
      .map((sense) => ({
        id: sense.id,
        definition: sense.definition,
        original: sense.original,
        machineTranslated: sense.machineTranslated
      }));
  }

  function getEntryExamples(entryId) {
    return examples
      .filter((example) => example.entryId === entryId)
      .map((example) => ({
        fr: example.fr,
        tr: example.tr,
        source: example.source
      }));
  }

  function getMatchType(entry, query) {
    if (!query) return entry.match;
    const queryVariants = getQueryVariants(query);
    if (queryVariants.includes(entry.normalized)) return entry.headword === query ? "tam" : "aksan";
    if (getEntryForms(entry.id).some((form) => queryVariants.includes(normalize(form.form)))) return "form";
    if (entry.translations.some((item) => queryVariants.some((variant) => normalize(item).includes(variant)))) return "anlam";
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
    return {
      id: entry.id,
      headword: entry.headword,
      pos: entry.pos,
      translations: entry.translations,
      match: entry.match
    };
  }

  function searchEntries(queryText) {
    const query = normalize(queryText);
    if (!query) return core.entries.map(toSummary);

    return core.entries
      .map((entry) => {
        const entryForms = getEntryForms(entry.id);
        const entrySenses = getEntrySenses(entry.id);
        const haystack = [
          entry.headword,
          entry.normalized,
          ...entryForms.map((form) => form.form),
          ...entry.translations,
          ...entrySenses.map((sense) => sense.definition)
        ]
          .map(normalize)
          .join(" ");

        const queryVariants = getQueryVariants(query, queryText);
        const exactScore = queryVariants.includes(entry.normalized) ? 100 : 0;
        const translationExactScore = entry.translations.some((translation) => queryVariants.includes(normalize(translation))) ? 95 : 0;
        const formScore = entryForms.some((form) => queryVariants.includes(normalize(form.form))) ? 80 : 0;
        const prefixScore = queryVariants.some((variant) => entry.normalized.startsWith(variant)) ? 60 : 0;
        const textScore = queryVariants.some((variant) => haystack.includes(variant)) ? 40 : 0;
        const score = Math.max(exactScore, translationExactScore, formScore, prefixScore, textScore);

        return {
          ...toSummary(entry),
          match: getMatchType(entry, query),
          score
        };
      })
      .filter((entry) => entry.score > 0)
      .sort(compareSearchResults);
  }

  function getEntry(entryId) {
    const entry = core.entries.find((item) => item.id === entryId);
    if (!entry) return null;

    return {
      ...entry,
      forms: getEntryForms(entry.id).map((form) => form.form),
      senses: getEntrySenses(entry.id),
      examples: getEntryExamples(entry.id)
    };
  }

  globalScope.FRAGE_DATA = {
    getEntry,
    searchEntries
  };
})(globalThis);
