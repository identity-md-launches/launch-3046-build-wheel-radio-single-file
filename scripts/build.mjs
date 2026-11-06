// Build: Wheel Radio is a single hand-written HTML file, so the production
// export is a verbatim copy of src/ into dist/ plus a few sanity checks.
// Usage: node scripts/build.mjs
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";

const FILES = ["index.html", "og-image.svg"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of FILES) await copyFile(`src/${file}`, `dist/${file}`);

const html = await readFile("dist/index.html", "utf8");
const problems = [];
// Root-absolute local URLs break under an IPFS gateway subpath or ENS name.
if (/\s(?:src|href)="\/(?!\/)/.test(html)) problems.push("root-absolute asset URL found");
for (const need of ["<title>", 'rel="icon"', 'name="description"', 'property="og:title"', 'property="og:image"']) {
  if (!html.includes(need)) problems.push(`missing ${need}`);
}
if (problems.length) {
  console.error("build failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`built dist/ (${FILES.join(", ")}), ${Buffer.byteLength(html)} bytes of HTML`);
