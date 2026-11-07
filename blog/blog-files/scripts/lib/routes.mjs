const validId = /^[a-f0-9]{12}$/;
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedName = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

export function slugify(title) {
  const slug = String(title)
    .replace(/\bc\s*#/gi, "csharp")
    .replace(/\bc\s*\+\+/gi, "cpp")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const shortened = slug.length > 110 ? slug.slice(0, 111).replace(/-[^-]*$/, "") : slug;
  const result = shortened.slice(0, 110).replace(/-+$/g, "") || "yazi";
  return reservedName.test(result) ? `yazi-${result}` : result;
}

export function articlePath(post) {
  const slug = post.slug || slugify(post.title);
  if (!validSlug.test(slug) || reservedName.test(slug)) throw new Error("Geçersiz yazı adresi.");
  return `yazi/${slug}/`;
}

export function assignSlugs(posts, previous = {}) {
  const routes = { ...previous };
  const used = new Set();
  for (const [id, slug] of Object.entries(routes)) {
    if (!validId.test(id) || typeof slug !== "string" || !validSlug.test(slug) || reservedName.test(slug) || used.has(slug))
      throw new Error("Kayıtlı yazı adresleri geçersiz veya yineleniyor.");
    used.add(slug);
  }
  // Keep published addresses stable, even if a title changes later.
  for (const post of [...posts].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!validId.test(post.id)) throw new Error("Geçersiz yazı kimliği.");
    if (routes[post.id]) continue;
    const base = slugify(post.title);
    let slug = base;
    if (used.has(slug)) slug = `${base}-${post.id}`;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${post.id}-${suffix++}`;
    routes[post.id] = slug;
    used.add(slug);
  }
  return routes;
}
