"use strict";

(() => {
  if (window.location.protocol === "file:") {
    document.querySelectorAll('.reader-related a.article-card, a[data-article-link], a[href="../../"]').forEach(link => {
      link.setAttribute("href", link.getAttribute("href") + "index.html");
    });
  }
  const themeButton = document.getElementById("theme-button");
  function syncTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    themeButton.setAttribute(
      "aria-label",
      dark ? "Açık temaya geç" : "Koyu temaya geç",
    );
    themeButton.setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#111822"
      : "#ffffff";
  }
  themeButton.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    syncTheme();
  });
  syncTheme();

  const toolbar = document.getElementById("reader-toolbar");
  const toolbarAnchor = document.getElementById("reader-toolbar-anchor");
  const toolbarTheme = document.getElementById("reader-toolbar-theme");
  const themeHome = themeButton.parentElement;
  const themePlaceholder = document.createElement("span");
  themePlaceholder.className = "reader-theme-placeholder";
  themePlaceholder.hidden = true;
  themePlaceholder.setAttribute("aria-hidden", "true");
  themeHome.insertBefore(themePlaceholder, themeButton);
  const mobileToolbar = window.matchMedia?.("(max-width: 800px)");
  function updateToolbar() {
    if (!toolbar || !toolbarAnchor || !toolbarTheme) return;
    const mobile = mobileToolbar ? mobileToolbar.matches : window.innerWidth <= 800;
    const stuck = mobile && toolbarAnchor.getBoundingClientRect().top <= 0;
    if (toolbar.classList.contains("is-stuck") === stuck) return;
    if (stuck) {
      // Preserve both the toolbar's original space and the theme button's header slot.
      toolbarAnchor.style.minHeight = `${Math.max(40, toolbar.offsetHeight)}px`;
      themePlaceholder.style.width = `${themeButton.offsetWidth || 28}px`;
      themePlaceholder.style.height = `${themeButton.offsetHeight || 32}px`;
      themePlaceholder.hidden = false;
      toolbarTheme.append(themeButton);
    } else {
      themeHome.insertBefore(themeButton, themePlaceholder);
      themePlaceholder.hidden = true;
      toolbarAnchor.style.minHeight = "";
    }
    toolbar.classList.toggle("is-stuck", stuck);
  }

  const progress = document.getElementById("reading-progress");
  const article = document.querySelector(".prose");
  let scheduled = false;
  function updateProgress() {
    updateTocLayout();
    updateToolbar();
    const start = article.getBoundingClientRect().top + window.scrollY;
    const available = Math.max(
      1,
      article.offsetHeight - window.innerHeight * 0.5,
    );
    progress.style.width = `${Math.min(100, Math.max(0, ((window.scrollY - start + window.innerHeight * 0.25) / available) * 100))}%`;
    scheduled = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(updateProgress);
      }
    },
    { passive: true },
  );
  window.addEventListener("resize", updateProgress);
  window.addEventListener("load", updateProgress);

  const tocLinks = [...document.querySelectorAll(".reader-toc a")];
  const tocDetails = document.querySelector(".reader-toc details");
  const tocPanel = document.getElementById("reader-toc-panel");
  const tocToggle = document.getElementById("reader-toc-toggle");
  const tocHome = document.createComment("Table of contents desktop position");
  tocPanel?.before(tocHome);
  let mobileToc = false;
  let desktopTocOpen = tocDetails?.hasAttribute("open");
  function setTocOpen(open, immediate = false) {
    if (!mobileToc) return;
    if (immediate) tocPanel.classList.add("is-navigating");
    tocToggle.setAttribute("aria-expanded", String(open));
    tocPanel.classList.toggle("is-open", open);
    tocPanel.toggleAttribute("inert", !open);
    if (immediate) {
      // Finish collapsing before the browser positions the selected heading.
      void tocPanel.offsetHeight;
      tocPanel.classList.remove("is-navigating");
    }
  }
  function updateTocLayout() {
    if (!tocPanel || !tocToggle || !toolbar) return;
    const mobile = mobileToolbar ? mobileToolbar.matches : window.innerWidth <= 800;
    if (mobile === mobileToc) return;
    mobileToc = mobile;
    toolbar.classList.toggle("has-mobile-toc", mobile);
    if (mobile) {
      desktopTocOpen = tocDetails.hasAttribute("open");
      tocDetails.setAttribute("open", "");
      toolbar.append(tocPanel);
      setTocOpen(false);
    } else {
      tocHome.after(tocPanel);
      tocPanel.classList.remove("is-open");
      tocPanel.removeAttribute("inert");
      tocDetails.toggleAttribute("open", desktopTocOpen);
      tocToggle.setAttribute("aria-expanded", "false");
    }
  }
  tocToggle?.addEventListener("click", () => {
    setTocOpen(tocToggle.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !mobileToc || tocToggle.getAttribute("aria-expanded") !== "true") return;
    setTocOpen(false);
    tocToggle.focus();
  });
  mobileToolbar?.addEventListener?.("change", () => {
    updateTocLayout();
    updateToolbar();
  });
  updateProgress();
  function highlightToc(activeLink) {
    tocLinks.forEach(link => {
      if (link === activeLink) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  const initialLink = tocLinks.find(link => link.hash === window.location.hash) || tocLinks[0];
  if (initialLink) highlightToc(initialLink);
  tocLinks.forEach(link => link.addEventListener("click", () => {
    highlightToc(link);
    setTocOpen(false, true);
  }));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const heading = entries.find((entry) => entry.isIntersecting)?.target;
        if (!heading) return;
        const activeLink = tocLinks.find(link => link.hash === `#${heading.id}`);
        if (activeLink) highlightToc(activeLink);
      },
      { rootMargin: "-8% 0px -70% 0px", threshold: 0 },
    );
    article
      .querySelectorAll("h1[id],h2[id],h3[id]")
      .forEach((heading) => observer.observe(heading));
  }

  const shareButton = document.getElementById("share-button");
  const shareStatus = document.getElementById("share-status");
  let resetTimer;
  shareButton.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href.split("#")[0]);
      shareButton.dataset.state = "copied";
      shareButton.setAttribute("aria-label", "Bağlantı kopyalandı");
      shareButton.title = "Bağlantı kopyalandı";
      shareStatus.textContent = "Makale bağlantısı kopyalandı.";
    } catch {
      shareButton.dataset.state = "error";
      shareButton.setAttribute("aria-label", "Bağlantıyı adres çubuğundan kopyalayabilirsin");
      shareButton.title = "Bağlantıyı adres çubuğundan kopyalayabilirsin";
      shareStatus.textContent =
        "Bağlantıyı tarayıcının adres çubuğundan kopyalayabilirsin.";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      delete shareButton.dataset.state;
      shareButton.setAttribute("aria-label", "Bağlantıyı kopyala");
      shareButton.title = "Bağlantıyı kopyala";
    }, 3500);
  });

  document.querySelectorAll("pre").forEach((pre) => {
    const codeText = pre.querySelector("code")?.textContent ?? pre.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.before(wrapper);
    wrapper.append(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.setAttribute("aria-label", "Kod bloğunu kopyala");
    button.title = "Kod bloğunu kopyala";
    button.innerHTML = '<svg class="icon code-copy-icon" aria-hidden="true"><use href="#i-copy"></use></svg><svg class="icon code-check-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"></path></svg>';
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    wrapper.prepend(button, status);
    let codeResetTimer;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeText);
        button.dataset.state = "copied";
        button.setAttribute("aria-label", "Kod kopyalandı");
        button.title = "Kod kopyalandı";
        status.textContent = "Kod bloğu kopyalandı.";
      } catch {
        button.dataset.state = "error";
        button.setAttribute("aria-label", "Kodu seçerek kopyalayabilirsin");
        button.title = "Kodu seçerek kopyalayabilirsin";
        status.textContent = "Otomatik kopyalama kullanılamıyor. Kodu seçerek kopyalayabilirsin.";
      }
      clearTimeout(codeResetTimer);
      codeResetTimer = setTimeout(() => {
        delete button.dataset.state;
        button.setAttribute("aria-label", "Kod bloğunu kopyala");
        button.title = "Kod bloğunu kopyala";
      }, 2500);
    });
  });

  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        if (img.closest(".prose")) {
          const message = document.createElement("span");
          message.className = "missing-image";
          message.textContent = img.alt || "Görsel yüklenemedi.";
          img.replaceWith(message);
        } else img.src = "../../blog-files/img/article-fallback.svg";
      },
      { once: true },
    );
  });
})();
