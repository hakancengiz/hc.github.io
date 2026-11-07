import { htmlDocument, textFromHtml } from "./content.mjs";
import { slugify } from "./routes.mjs";

export function parseSeriesTitle(title) {
  const match = String(title).match(/^(.+?\s+Ser[iıİ]s[iıİ])\s*(?:[—–:-]\s*)?#\s*(\d{1,4})(?!\d)/iu);
  if (!match || Number(match[2]) < 1) return null;
  const name = match[1].trim().replace(/\s+/g, " ");
  const chapterTitle = String(title).slice(match[0].length).replace(/^[\s:—–.-]+/u, "").trim() || String(title);
  return { key: slugify(name), name, part: Number(match[2]), chapterTitle };
}

export function buildSeriesIndex(posts) {
  const groups = new Map();
  for (const post of posts) {
    const series = parseSeriesTitle(post.title);
    if (!series) continue;
    if (!groups.has(series.key)) groups.set(series.key, []);
    groups.get(series.key).push({ post, ...series });
  }
  const index = new Map();
  for (const chapters of groups.values()) {
    chapters.sort((a, b) => a.part - b.part || a.post.pubDate.localeCompare(b.post.pubDate) || a.post.id.localeCompare(b.post.id));
    const continuous = chapters.every((chapter, position) => chapter.part === position + 1);
    chapters.forEach((chapter, position) => index.set(chapter.post.id, {
      key: chapter.key,
      name: chapters[0].name,
      part: chapter.part,
      position: position + 1,
      total: chapters.length,
      continuous,
      chapters,
      previous: chapters[position - 1]?.post || null,
      next: chapters[position + 1]?.post || null,
    }));
  }
  return index;
}

const stopWords = new Set(`a an and are as at be been being but by can do does for from has have how if in into is it its of on or that the their then there these this to was we were what when which why will with you your
  bir ve veya bu su o da de icin ile gibi daha en cok az her hic ne neden nasil nedir mi mu ama ancak yani olarak olan olur olmak zaman sonra once kadar hem sadece ayni fark farki farklar sey seyi seyler
  ben biz sen siz onlar benim bizim senin sizin bunu buna bunun sunu suna sunun onu onun boyle soyle cunku aslinda genelde cogu bazi tum artik ise bile diye degil gerekiyor gerekir kullanilir kullanmak kullanimi kullanarak kullanilan yapar yapmak yapisi yapilar
  serisi bolum giris temeller ornek ornegin ornekler kod yazilim software development engineering developer turkce turkish english gelistirme uygulama uygulamalar`.split(/\s+/).filter(Boolean));

function tokens(value) {
  return String(value)
    .replace(/\bc\s*#/gi, " csharp ")
    .replace(/\bc\s*\+\+/gi, " cpp ")
    .toLocaleLowerCase("tr-TR").replace(/ı/g, "i")
    .normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/\.net\b|\bdotnet\b/g, " dotnet ")
    .match(/[a-z][a-z0-9]{1,}/g)?.filter(token => !stopWords.has(token)) || [];
}

function features(post) {
  const doc = htmlDocument(post.content || "");
  doc.querySelectorAll("pre,code,svg,script,style").forEach(node => node.remove());
  const frequencies = new Map();
  for (const term of tokens(textFromHtml(doc.body.innerHTML))) frequencies.set(term, (frequencies.get(term) || 0) + 1);
  const body = new Map([...frequencies].map(([term, count]) => [term, 1 + Math.log(Math.min(count, 8))]));
  const title = new Map();
  for (const term of tokens(post.title)) title.set(term, (title.get(term) || 0) + 1);
  const categories = new Map([...new Set(tokens((post.categories || []).join(" ")))].map(term => [term, 1]));
  return [[body, 1], [title, 1.6], [categories, 0.9]];
}

export function createRelatedSelector(posts) {
  const uniquePosts = [...new Map(posts.map(post => [post.id, post])).values()];
  const fields = new Map(uniquePosts.map(post => [post.id, features(post)]));
  const documentFrequency = new Map();
  for (const parts of fields.values()) {
    const terms = new Set(parts.flatMap(([vector]) => [...vector.keys()]));
    for (const term of terms) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  }
  const vectors = new Map();
  const lengths = new Map();
  for (const [id, parts] of fields) {
    const combined = new Map();
    // Normalize each field independently so a different title cannot bury a strong content match.
    for (const [vector, fieldWeight] of parts) {
      let squared = 0;
      for (const [term, frequency] of vector) {
        const weighted = frequency * Math.log(1 + (uniquePosts.length - documentFrequency.get(term) + 0.5) / (documentFrequency.get(term) + 0.5));
        vector.set(term, weighted);
        squared += weighted * weighted;
      }
      const norm = Math.sqrt(squared) || 1;
      for (const [term, weight] of vector) combined.set(term, (combined.get(term) || 0) + weight / norm * fieldWeight);
    }
    vectors.set(id, combined);
    lengths.set(id, Math.sqrt([...combined.values()].reduce((sum, weight) => sum + weight * weight, 0)));
  }
  return (post, limit = 3) => {
    const current = vectors.get(post.id);
    if (!current || !lengths.get(post.id)) return [];
    const series = parseSeriesTitle(post.title);
    return uniquePosts.filter(candidate => candidate.id !== post.id).map(candidate => {
      let dot = 0;
      for (const [term, weight] of current) dot += weight * (vectors.get(candidate.id).get(term) || 0);
      const similarity = dot / (lengths.get(post.id) * lengths.get(candidate.id) || 1);
      const sameSeries = series && parseSeriesTitle(candidate.title)?.key === series.key;
      return { post: candidate, score: similarity + (sameSeries ? 0.04 : 0) };
    }).filter(candidate => candidate.score >= 0.035)
      .sort((a, b) => b.score - a.score || b.post.pubDate.localeCompare(a.post.pubDate) || a.post.id.localeCompare(b.post.id))
      .slice(0, Math.max(0, limit)).map(candidate => candidate.post);
  };
}
