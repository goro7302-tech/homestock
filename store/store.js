// Shared helpers for the store pages (catalog, article, legal).
(function () {
  const cfg = window.STORE_CONFIG || {};

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Minimal, safe Markdown → HTML (headings, lists, quotes, bold/italic, links).
  function md(src) {
    const inline = (t) =>
      esc(t)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');
    const out = [];
    let list = null;
    let para = [];
    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(src || "").split(/\r?\n/)) {
      const line = raw.trim();
      let m;
      if (!line) { flushPara(); flushList(); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flushPara(); flushList();
        const lvl = Math.min(m[1].length + 1, 4); // page owns <h1>
        out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      } else if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+[.)]\s+(.*)$/))) {
        flushPara();
        const type = /^\d/.test(line) ? "ol" : "ul";
        if (list !== type) { flushList(); out.push(`<${type}>`); list = type; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); flushList();
        out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  const price = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cfg.currency || "USD" }).format(Number(n) || 0);

  const coverStyle = (a) => {
    const h = Number(a.cover?.hue ?? 20);
    return `background: linear-gradient(135deg, hsl(${h} 70% 82%), hsl(${(h + 40) % 360} 60% 68%));`;
  };

  async function loadArticles() {
    const res = await fetch("data/articles.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load catalog");
    const data = await res.json();
    return (data.articles || []).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  }

  function chrome() {
    document.querySelectorAll("[data-brand]").forEach((el) => {
      const [first, ...rest] = (cfg.brand || "Store").split(" ");
      el.innerHTML = `${esc(first)}<span>${rest.length ? " " + esc(rest.join(" ")) : "."}</span>`;
    });
    document.querySelectorAll("[data-brand-plain]").forEach((el) => (el.textContent = cfg.brand || ""));
    document.querySelectorAll("[data-tagline]").forEach((el) => (el.textContent = cfg.tagline || ""));
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    document.querySelectorAll("[data-contact]").forEach((el) => {
      if (cfg.contactEmail) el.innerHTML = `${el.closest("footer") ? " · " : ""}<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>`;
      else el.remove();
    });
  }

  window.Store = { cfg, esc, md, price, coverStyle, loadArticles, chrome };
  document.addEventListener("DOMContentLoaded", chrome);
})();
