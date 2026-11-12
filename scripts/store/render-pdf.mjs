// Turns a guide's Markdown into a reader-friendly PDF (cover page + styled body).
// Usage: node render-pdf.mjs <guide.md> [out.pdf]
// Needs Playwright's Chromium and fonts with Japanese glyphs (e.g. fonts-noto-cjk).

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { marked } from "marked";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [input, output = input.replace(/\.md$/, "") + ".pdf"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node render-pdf.mjs <guide.md> [out.pdf]");
  process.exit(1);
}

const src = await readFile(input, "utf8");

// The generator writes: "# Title\n\n*Subtitle*\n\n<body>"
const m = src.match(/^#\s+(.+)\n+\*(.+?)\*\n+([\s\S]*)$/);
const title = m ? m[1].trim() : "Guide";
const subtitle = m ? m[2].trim() : "";
const body = m ? m[3] : src;

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A5; margin: 18mm 16mm 20mm; }
  @page :first { margin: 0; }
  html { font-family: "Noto Serif", "Noto Serif CJK JP", "Noto Sans CJK JP", serif; font-size: 10.5pt; line-height: 1.6; color: #1f1b16; }
  body { margin: 0; }
  .cover { height: 210mm; box-sizing: border-box; padding: 28mm 18mm; display: flex; flex-direction: column;
           background: linear-gradient(160deg, #f6e3d6, #e7b9a3); page-break-after: always; }
  .cover .brand { font-family: "Noto Sans", "Noto Sans CJK JP", sans-serif; letter-spacing: .12em; text-transform: uppercase; font-size: 8.5pt; color: #8a3a26; }
  .cover h1 { font-size: 24pt; line-height: 1.15; margin: auto 0 10mm; }
  .cover p { font-size: 11.5pt; color: #4a3f36; margin: 0 0 20mm; }
  .cover .foot { font-family: "Noto Sans", sans-serif; font-size: 8pt; color: #6b5c50; }
  h2 { font-size: 15pt; line-height: 1.25; margin: 0 0 4mm; padding-top: 2mm; break-before: page; color: #8a3a26; }
  h3 { font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 4mm 0 1mm; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 5mm; }
  li { margin: 1mm 0; }
  blockquote { margin: 3mm 0; padding: 2mm 4mm; border-left: 2.5pt solid #b5462f; background: #faf3ee; color: #4a3f36; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 3mm 0; break-inside: avoid; }
  th, td { border: .5pt solid #d8cdc2; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
  th { background: #f3ebe3; }
  code { font-family: "Noto Sans Mono", monospace; font-size: 9pt; background: #f3ebe3; padding: 0 1mm; border-radius: 1mm; }
  pre { background: #f3ebe3; padding: 3mm; white-space: pre-wrap; font-size: 9pt; break-inside: avoid; }
  hr { border: 0; border-top: .5pt solid #d8cdc2; margin: 8mm 0 4mm; }
  hr + p { font-size: 8.5pt; color: #6b5c50; }
  a { color: #8a3a26; }
</style></head>
<body>
  <section class="cover">
    <div class="brand">Dashi Press</div>
    <h1>${esc(title)}</h1>
    <p>${esc(subtitle)}</p>
    <div class="foot">Personal-use copy. Please do not share or resell.</div>
  </section>
  <main>${marked.parse(body)}</main>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: output,
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:7pt;color:#8a7d72;text-align:center;font-family:sans-serif"><span class="pageNumber"></span></div>`,
});
await browser.close();
console.log(`PDF written: ${output}`);
