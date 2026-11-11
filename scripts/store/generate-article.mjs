// Generates one new English guide with Claude and adds it to the store.
//
// - Public preview + metadata  -> store/data/articles.json   (committed, shown on the site)
// - Full paid guide (Markdown) -> scripts/store/out/<slug>.md (NOT committed; upload it to
//                                 your checkout platform, e.g. Gumroad / Lemon Squeezy)
//
// Usage:  ANTHROPIC_API_KEY=... node generate-article.mjs [--category "Business"] [--dry-run]

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(here, "../../store/data/articles.json");
const OUT_DIR = path.resolve(here, "out");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");

const niches = JSON.parse(await readFile(path.join(here, "niches.json"), "utf8"));
const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
const articles = catalog.articles ?? [];

// Pick the category with the fewest guides unless one is given.
const categories = Object.keys(niches.categories);
const category =
  flag("--category") ??
  categories
    .map((c) => [c, articles.filter((a) => a.category === c).length])
    .sort((a, b) => a[1] - b[1])[0][0];
if (!niches.categories[category]) {
  console.error(`Unknown category "${category}". Choose one of: ${categories.join(", ")}`);
  process.exit(1);
}

const [minPrice, maxPrice] = niches.priceRangeUsd;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "slug", "title", "subtitle", "tags", "priceUsd", "readingMinutes",
    "coverEmoji", "coverHue", "tableOfContents", "previewMarkdown", "fullMarkdown",
  ],
  properties: {
    slug: { type: "string", description: "lowercase-kebab-case, unique, max 60 chars" },
    title: { type: "string" },
    subtitle: { type: "string", description: "One sentence promise of what the reader gets" },
    tags: { type: "array", items: { type: "string" } },
    priceUsd: { type: "integer", description: `Whole US dollars between ${minPrice} and ${maxPrice}` },
    readingMinutes: { type: "integer" },
    coverEmoji: { type: "string", description: "A single emoji" },
    coverHue: { type: "integer", description: "0-359 HSL hue for the cover gradient" },
    tableOfContents: { type: "array", items: { type: "string" }, description: "5-8 section titles of the full guide" },
    previewMarkdown: { type: "string", description: "Free preview: the opening ~250-350 words. Must be genuinely useful on its own." },
    fullMarkdown: { type: "string", description: "The complete guide in Markdown, including the preview as its opening." },
  },
};

const system = `You are the senior editor of ${"Dashi Press"}, a small publisher of paid English-language guides about Japan for readers outside Japan.

Write guides that are worth paying for: concrete steps, real Japanese terms with romaji and meaning, specific examples, checklists and templates. Avoid filler, hype and generic advice a reader could find in the first search result.

Accuracy rules:
- Only state facts you are confident are true. For anything that changes often (fees, exchange rates, visa rules, opening hours), describe how to check it and point to the official source type (e.g. "your ward office", "Immigration Services Agency") instead of quoting a number.
- Never present the guide as legal, tax, immigration or medical advice.
- Do not imitate or name any specific existing author, publication or brand.

Format: Markdown with ## and ### headings, short paragraphs, lists where they help. The full guide should be 2,500-4,000 words.`;

const existing = articles.map((a) => `- ${a.title} (${a.category})`).join("\n") || "(none yet)";
const prompt = `Create one new guide for the category "${category}": ${niches.categories[category]}

Already published — do not duplicate these topics:
${existing}

Pick the topic you think international readers would most want to pay for right now, then write it.`;

const client = new Anthropic();

console.log(`Generating a "${category}" guide...`);
const stream = client.beta.messages.stream({
  model: "claude-opus-5-5",
  max_tokens: 64000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default", // if the request is declined, the API retries it on a recommended fallback model
  output_config: {
    effort: "high",
    format: { type: "json_schema", schema },
  },
  system,
  messages: [{ role: "user", content: prompt }],
});
const message = await stream.finalMessage();

if (message.stop_reason === "refusal") {
  console.error("The model declined this request:", message.stop_details ?? "(no details)");
  process.exit(1);
}
if (message.stop_reason === "max_tokens") {
  console.error("Output was cut off (max_tokens). Try again.");
  process.exit(1);
}

const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
const g = JSON.parse(text);

// Normalise + make the slug unique.
let slug = String(g.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "guide";
const taken = new Set(articles.map((a) => a.slug));
for (let n = 2, base = slug; taken.has(slug); n++) slug = `${base}-${n}`;

const entry = {
  slug,
  title: g.title,
  subtitle: g.subtitle,
  category,
  tags: g.tags,
  priceUsd: Math.min(maxPrice, Math.max(minPrice, Math.round(g.priceUsd))),
  readingMinutes: g.readingMinutes,
  publishedAt: new Date().toISOString().slice(0, 10),
  cover: { emoji: g.coverEmoji, hue: ((Math.round(g.coverHue) % 360) + 360) % 360 },
  aiAssisted: true,
  checkoutUrl: "",
  tableOfContents: g.tableOfContents,
  previewMarkdown: g.previewMarkdown,
};

const full = `# ${g.title}\n\n*${g.subtitle}*\n\n${g.fullMarkdown}\n\n---\n\n© ${new Date().getFullYear()} Dashi Press. For personal use only. This guide was drafted with AI assistance and is general information, not professional advice.\n`;

console.log(`Title: ${entry.title}\nSlug:  ${slug}\nPrice: $${entry.priceUsd}\nUsage: ${JSON.stringify(message.usage)}`);

if (dryRun) {
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, `${slug}.md`), full);
catalog.articles = [entry, ...articles];
await writeFile(CATALOG, JSON.stringify(catalog, null, 2) + "\n");

// Expose the slug to GitHub Actions if running there.
if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${entry.title.replace(/\n/g, " ")}\n`, { flag: "a" });
}
console.log(`\nSaved preview to store/data/articles.json and full guide to scripts/store/out/${slug}.md`);
