// Static checks for the single-file site (no dependencies).
// 1. The inline script parses (syntax check via node:vm, never executed).
// 2. Every $("id") the script looks up exists in the markup.
// 3. dist/ is byte-identical to src/ (the committed export is current).
// 4. Pure helpers behave: mulberry32 determinism, makeSong shape, parseTime.
// Usage: node scripts/check.mjs
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const fail = [];
const ok = (msg) => console.log("ok   " + msg);
const bad = (msg) => { fail.push(msg); console.log("FAIL " + msg); };

const src = await readFile("src/index.html", "utf8");
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) bad(`expected 1 inline script, found ${scripts.length}`);
const code = scripts[0] ?? "";

try { new vm.Script(code, { filename: "inline.js" }); ok("inline script parses"); }
catch (err) { bad("inline script syntax: " + err.message); }

const ids = new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const used = [...new Set([...code.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]))];
const missing = used.filter((id) => !ids.has(id));
missing.length ? bad("missing ids: " + missing.join(", ")) : ok(`all ${used.length} looked-up ids exist`);

for (const file of ["index.html", "og-image.svg"]) {
  const a = await readFile(`src/${file}`).catch(() => null);
  const b = await readFile(`dist/${file}`).catch(() => null);
  if (!a || !b) bad(`dist/${file} or src/${file} missing`);
  else a.equals(b) ? ok(`dist/${file} matches src`) : bad(`dist/${file} is out of date, run npm run build`);
}

// Evaluate only the pure helpers in a sandbox.
const pick = (name) => {
  const m = code.match(new RegExp(`(?:function ${name}\\b|const ${name}\\s*=)[\\s\\S]*?\\n}\\;?\\n`));
  return m ? m[0] : "";
};
const helpers = [
  code.match(/const clamp = .*\n/)?.[0], code.match(/const num = .*\n/)?.[0],
  pick("mulberry32"), pick("parseTime"),
  code.match(/const CHORDS = [\s\S]*?\n};\n/)?.[0], code.match(/const PROGS = [\s\S]*?\n\];\n/)?.[0],
  code.match(/const PENTA = .*\n/)?.[0], code.match(/const ADJ = .*\n/)?.[0], code.match(/const NOUN = .*\n/)?.[0],
  pick("makeSong"),
].join("");
try {
  const ctx = vm.createContext({});
  vm.runInContext(helpers + "\nthis.api = { mulberry32, parseTime, makeSong, PROGS };", ctx);
  const { mulberry32, parseTime, makeSong, PROGS } = ctx.api;
  const a = mulberry32(1140), b = mulberry32(1140);
  (a() === b() && a() === b()) ? ok("mulberry32 is deterministic") : bad("mulberry32 not deterministic");
  const s1 = makeSong(1140), s2 = makeSong(1140), s3 = makeSong(1141);
  (s1.notes.length === 64 && s1.rolls.length === 64) ? ok("makeSong builds 64 sixteenths") : bad("makeSong length");
  (JSON.stringify(s1) === JSON.stringify(s2)) ? ok("same block, same song") : bad("same block gave different songs");
  (s1.prog === PROGS[1140 % 4] && s3.prog === PROGS[1141 % 4]) ? ok("progression follows blockHeight % 4") : bad("progression mapping");
  (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s1.name)) ? ok(`track name "${s1.name}"`) : bad("track name format");
  (parseTime("1700000000") === 1.7e12 && parseTime(1.7e12) === 1.7e12 && parseTime("2026-01-01T00:00:00Z") === Date.UTC(2026, 0, 1) && parseTime(null) === 0)
    ? ok("parseTime handles seconds, ms, ISO, null") : bad("parseTime");
} catch (err) { bad("helper evaluation: " + err.message); }

console.log(fail.length ? `\n${fail.length} check(s) failed` : "\nall checks passed");
process.exit(fail.length ? 1 : 0);
