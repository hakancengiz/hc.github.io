const emojiPattern = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu;
const icons = {
  "📦": ["Paket", "m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v8M7.5 5.5l9 5"],
  "📁": ["Dosya", "M3 7V5h6l2 2h10v13H3V7Z"],
  "📂": ["Klasör", "M3 10V5h6l2 2h9v3M3 10h19l-3 10H2l1-10Z"],
  "🎯": ["Odak", "M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5"],
  "✅": ["Onay", "m5 12 4 4L19 6"],
  "⚠": ["Uyarı", "M12 3 2 21h20L12 3Zm0 6v5m0 3v.1"],
  "🧠": ["Fikir", "M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"],
  "🔹": ["Madde", "m12 6 6 6-6 6-6-6 6-6Z"],
  "🔸": ["Madde", "m12 6 6 6-6 6-6-6 6-6Z"],
};

export function withoutDecorativeEmoji(text) {
  return text.replace(emojiPattern, "");
}

export function replaceArticleIcons(document) {
  function visit(parent) {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 1) {
        if (!/^(PRE|CODE|SVG|SCRIPT|STYLE)$/i.test(node.tagName)) visit(node);
        continue;
      }
      if (node.nodeType !== 3) continue;
      const matches = [...node.textContent.matchAll(emojiPattern)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let end = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(node.textContent.slice(end, match.index)));
        const [label, path] = icons[match[0].replace(/\uFE0F/g, "")] || ["Simge", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"];
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "icon prose-icon");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);
        const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
        shape.setAttribute("d", path);
        svg.append(shape);
        fragment.append(svg);
        end = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(node.textContent.slice(end)));
      node.replaceWith(fragment);
    }
  }
  visit(document.body);
}
