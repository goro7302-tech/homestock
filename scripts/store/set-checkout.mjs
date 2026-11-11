// Attach a checkout link (Gumroad / Lemon Squeezy / Stripe Payment Link) to a guide.
// Usage: node set-checkout.mjs <slug> <https://checkout-url>
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [slug, url] = process.argv.slice(2);
if (!slug || !/^https:\/\//.test(url ?? "")) {
  console.error("Usage: node set-checkout.mjs <slug> <https://checkout-url>");
  process.exit(1);
}
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../store/data/articles.json");
const catalog = JSON.parse(await readFile(file, "utf8"));
const a = catalog.articles.find((x) => x.slug === slug);
if (!a) {
  console.error(`No guide with slug "${slug}". Known: ${catalog.articles.map((x) => x.slug).join(", ")}`);
  process.exit(1);
}
a.checkoutUrl = url;
await writeFile(file, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Checkout link set for "${a.title}".`);
