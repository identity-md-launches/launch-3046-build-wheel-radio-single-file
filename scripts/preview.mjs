// Local static preview of dist/ under a subpath, like an IPFS gateway would serve it.
// Usage: node scripts/preview.mjs [port]  ->  http://localhost:4173/preview/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2]) || 4173;
const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/preview/")) { res.writeHead(302, { location: "/preview/" }); return res.end(); }
  let rel = normalize(decodeURIComponent(url.pathname.slice("/preview/".length))).replace(/^(\.\.[/\\])+/, "");
  if (!rel || rel.endsWith("/")) rel += "index.html";
  try {
    const body = await readFile(join("dist", rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(port, () => console.log(`Wheel Radio preview: http://localhost:${port}/preview/ (Ctrl+C to stop)`));
