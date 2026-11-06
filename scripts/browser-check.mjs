// Optional browser regressions for the committed export. No runtime dependencies.
// Pass an installed Playwright module: node scripts/browser-check.mjs /path/to/index.mjs
// API fixtures below are test data, never production or live-chain evidence.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Pass the path to an installed Playwright index.mjs module.");
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href);
const reportPath = process.argv[3] || "test/scratch/browser-results.json";
const shots = "test/scratch/revision-shots";
await mkdir(shots, { recursive: true });
const server = createServer(async (req, res) => {
  const path = req.url === "/preview/" ? "index.html" : req.url === "/preview/og-image.svg" ? "og-image.svg" : null;
  if (!path) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith("svg") ? "image/svg+xml" : "text/html" });
  res.end(await readFile(`dist/${path}`));
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const results = [], scriptErrors = [];
const record = (name, evidence) => { results.push({ name, passed: true, evidence }); console.log("ok   " + name); };

async function open(options = {}) {
  const fixture = { work: "1000", spinning: true, oldWork: 0, failStatus: false, failSettlements: false, ...options };
  const page = await browser.newPage({ viewport: { width: options.width || 390, height: 844 } });
  page.on("pageerror", e => scriptErrors.push(e.message));
  if (options.blocked) await page.addInitScript(() => {
    window.testResume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      return this.suspend().then(() => { throw new DOMException("Audio was blocked", "NotAllowedError"); });
    };
  });
  // Deterministic interaction checks use the existing font fallbacks.
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ contentType: "text/css", body: "" }));
  await page.route("https://api.squeekchain.com/v1/**", r => {
    const status = r.request().url().includes("/status");
    if (status ? fixture.failStatus : fixture.failSettlements) return r.abort();
    return r.fulfill({ json: status ? {
      measurement: { coreStatus: fixture.spinning ? "SPINNING" : "IDLE", rpmMilli: "42000", cumulativeWorkUnits: fixture.work,
        distanceMm: "1000000", observedAt: new Date().toISOString(), staleAfterSeconds: "120" },
      builder: { projected: { blockHeight: "1140", blockProgress: "500000000" } },
    } : { buckets: Array.from({ length: 24 }, (_, i) => ({ workAdded: String(i === 22 ? fixture.oldWork : 0) })) } });
  });
  await page.goto(url);
  await page.waitForFunction(() => S.hasData && S.buckets.length === 24);
  await page.waitForTimeout(350); // let the existing 300ms state colors settle for screenshots
  return { page, fixture };
}

async function voices(page) {
  return page.evaluate(() => {
    const counts = { padChord: 0, kick: 0, hat: 0, bassNote: 0, pluck: 0 }, saved = {};
    for (const k of Object.keys(counts)) { saved[k] = Engine[k]; Engine[k] = () => counts[k]++; }
    try { for (let i = 0; i < 16; i++) Engine.playStep(i, Engine.ctx.currentTime + .2); }
    finally { Object.assign(Engine, saved); }
    return counts;
  });
}

try {
  browser = await chromium.launch({ headless: true });
  let { page, fixture } = await open({ oldWork: 600 });
  await page.evaluate(() => pollStatus());
  const history = await page.evaluate(() => {
    const startup = { gained: workGained(), mood: moodKey(), samples: S.workLog.length };
    const clock = Date.now, now = clock();
    Date.now = () => now;
    const check = (entries) => { S.workLog = entries.map(([age, w]) => ({ t: now - age, w })); return workGained(); };
    try {
      const boundary = check([[610000, 100], [590000, 130], [0, 200]]);
      const exactBoundary = check([[600000, 120], [590000, 130], [0, 220]]);
      const expired = check([[900000, 100], [700000, 200]]);
      const warmup = check([[5000, 1000], [0, 1001]]);
      const journey = moodKey();
      check([[5000, 1000], [0, 1100]]);
      const storm = moodKey();
      S.workLog = [{ t: now - 1200000, w: 100 }, { t: now - 610000, w: 150 }, { t: now - 590000, w: 160 }];
      applyStatus({ work: 200, height: S.height }, true);
      const retained = { ages: S.workLog.map(s => now - s.t), gained: workGained() };
      S.workLog = [{ t: now - 1200000, w: 100 }];
      applyStatus({ work: 140, height: S.height }, true);
      return { startup, boundary, exactBoundary, expired, warmup, journey, storm, retained,
        longGap: { samples: S.workLog.length, gained: workGained() } };
    } finally { Date.now = clock; }
  });
  assert.equal(history.startup.gained, 0); assert.equal(history.startup.mood, "nap");
  assert.equal(history.boundary, 100); assert.equal(history.exactBoundary, 100); assert.equal(history.expired, 0);
  assert.equal(history.warmup, 1); assert.equal(history.journey, "journey"); assert.equal(history.storm, "storm");
  assert.deepEqual(history.retained, { ages: [610000, 590000, 0], gained: 50 });
  assert.deepEqual(history.longGap, { samples: 2, gained: 40 });
  record("Observed rolling history, warm-up, boundary retention and expired gains", history);
  await page.close();

  ({ page, fixture } = await open());
  await page.locator("#play").click();
  await page.evaluate(() => { clearInterval(Engine.timer); Engine.mix(); });
  await page.waitForTimeout(650);
  const nap = await voices(page);
  assert.deepEqual(nap, { padChord: 1, kick: 0, hat: 0, bassNote: 0, pluck: 0 });
  assert.equal(await page.evaluate(() => Engine.drums.gain.value + Engine.bass.gain.value + Engine.melody.gain.value), 0);
  fixture.work = "1020";
  await page.evaluate(() => {
    S.work = 1020; S.workLog = [{ t: Date.now() - 1000, w: 1000 }, { t: Date.now(), w: 1020 }]; Engine.mix();
  });
  await page.waitForFunction(() => Engine.drums.gain.value > .99 && Engine.bass.gain.value > .99, null, { timeout: 6000 });
  const journey = await voices(page);
  assert.equal(journey.kick, 3); assert.equal(journey.hat, 4); assert.equal(journey.bassNote, 3); assert.ok(journey.pluck > 0);
  await page.evaluate(() => { S.workLog = [{ t: Date.now(), w: 1020 }]; Engine.mix(); });
  await page.waitForFunction(() => Engine.drums.gain.value < .001 && Engine.bass.gain.value < .001, null, { timeout: 6000 });
  const fadedNap = await page.evaluate(() => ({ drums: Engine.drums.gain.value, bass: Engine.bass.gain.value, melody: Engine.melody.gain.value, ambient: Engine.amb.gain.value }));
  assert.ok(fadedNap.melody < .001); assert.equal(fadedNap.ambient, 0);
  fixture.spinning = false;
  await page.evaluate(async () => { await pollStatus(); Engine.mix(); });
  await page.waitForFunction(() => Engine.amb.gain.value > .99, null, { timeout: 6000 });
  const idle = await page.evaluate(() => ({ ambient: isAmbient(), gain: Engine.amb.gain.value, bpm: targetBpm() }));
  assert.equal(idle.ambient, true); assert.equal(idle.bpm, 60);
  record("Nap pad-only voices, Journey rhythm, four-second bus fades and IDLE ambient", { nap, journey, fadedNap, idle });
  await page.close();

  ({ page, fixture } = await open());
  await page.locator("#play").click();
  fixture.failStatus = true;
  await page.evaluate(() => pollStatus());
  assert.equal(await page.locator("#badge").textContent(), "reconnecting");
  await page.evaluate(() => { S.observedAt = Date.now() - 121000; render(); Engine.mix(); });
  const stale = await page.evaluate(() => ({ badge: el.badge.textContent, summary: el.summary.textContent, announcement: el.announce.textContent,
    stale: isStale(), ambient: isAmbient(), state: Engine.ctx.state, work: S.work }));
  for (const text of [stale.badge, stale.summary, stale.announcement]) { assert.match(text, /data stale/); assert.match(text, /reconnecting/); }
  assert.equal(stale.stale, true); assert.equal(stale.ambient, true); assert.equal(stale.state, "running"); assert.equal(stale.work, 1000);
  await page.waitForFunction(() => Engine.drums.gain.value < .001 && Engine.amb.gain.value > .99, null, { timeout: 6000 });
  fixture.failStatus = false;
  await page.evaluate(() => pollStatus());
  assert.equal(await page.locator("#badge").textContent(), "live");
  assert.equal(await page.evaluate(() => Engine.ctx.state), "running");
  record("Stale plus reconnecting feedback, retained values, ambient fade and live recovery", stale);
  await page.close();

  ({ page } = await open());
  const chart = await page.evaluate(() => ({ note: el.chartNote.textContent, heights: [...el.chart.querySelectorAll(".b")].map(r => Number(r.getAttribute("height"))) }));
  assert.equal(chart.note, "0 work in 24 h · busiest bucket 0"); assert.ok(chart.heights.every(h => h === 0));
  const mixedChart = await page.evaluate(() => {
    S.buckets = [0, 2, 4].map(work => ({ work, label: "Test bucket" })); renderChart();
    return { note: el.chartNote.textContent, heights: [...el.chart.querySelectorAll(".b")].map(r => Number(r.getAttribute("height"))) };
  });
  assert.deepEqual(mixedChart.heights, [0, 41, 82]); assert.match(mixedChart.note, /6 work.*busiest bucket 4/);
  record("Zero-work chart reports zero and mixed chart retains its scale", { chart, mixedChart });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const widths = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const rotated = await page.evaluate(() => {
      document.querySelector(".sky i").style.left = "100%";
      const measurements = [];
      for (let angle = 0; angle < 360; angle += 15) {
        el.wheel.style.transform = `rotate(${angle}deg)`;
        measurements.push(document.documentElement.scrollWidth);
      }
      return { width: document.documentElement.clientWidth, widest: Math.max(...measurements), wheel: el.wheel.clientWidth,
        runningAnimations: document.getAnimations().filter(a => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity).length };
    });
    assert.equal(rotated.widest, width); assert.equal(rotated.wheel, 264); assert.equal(rotated.runningAnimations, 0);
    widths.push(rotated);
    if (width === 320) {
      await page.evaluate(() => { el.wheel.style.transform = "rotate(45deg)"; });
      await page.screenshot({ path: `${shots}/320-player.png` });
      const staleWidth = await page.evaluate(() => {
        S.observedAt = Date.now() - 121000; S.conn = "reconnecting"; render();
        return document.documentElement.scrollWidth;
      });
      assert.equal(staleWidth, 320);
      await page.evaluate(() => { S.observedAt = Date.now(); S.conn = "live"; render(); });
    }
  }
  record("No overflow through a complete rotation at 320, 390 and 1440; reduced motion", widths);
  await page.close();

  ({ page } = await open({ blocked: true }));
  await page.locator("#play").click();
  const blocked = await page.evaluate(() => ({ hint: el.hint.textContent, playing: S.playing, state: Engine.ctx.state, label: el.play.getAttribute("aria-label") }));
  assert.match(blocked.hint, /This browser blocked audio.*press play again/); assert.doesNotMatch(blocked.hint, /Paused/);
  assert.equal(blocked.playing, false); assert.equal(blocked.state, "suspended"); assert.equal(blocked.label, "Play Wheel Radio");
  await page.evaluate(() => { AudioContext.prototype.resume = window.testResume; });
  await page.locator("#play").press("Enter");
  await page.waitForFunction(() => S.playing && Engine.ctx.state === "running");
  assert.match(await page.locator("#hint").textContent(), /On air/);
  await page.locator("#play").press("Space");
  await page.waitForFunction(() => !S.playing && Engine.ctx.state === "suspended");
  assert.match(await page.locator("#hint").textContent(), /Paused/);
  record("Blocked Play keeps recovery instructions; Enter retries and Space pauses", blocked);
  await page.close();

  ({ page } = await open());
  assert.equal(await page.evaluate(() => Engine.ctx), null);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "play");
  const firstScreen = await page.evaluate(() => {
    const b = el.play.getBoundingClientRect(), cs = getComputedStyle(el.play);
    return { playTop: b.top, playBottom: b.bottom, viewportHeight: innerHeight, focus: cs.outlineStyle, focusWidth: cs.outlineWidth };
  });
  assert.ok(firstScreen.playBottom < firstScreen.viewportHeight); assert.equal(firstScreen.focus, "solid");
  await page.screenshot({ path: `${shots}/390-focus.png` });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => S.playing);
  await page.keyboard.press("Tab"); await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => S.volume), .79);
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => S.muted), true);
  await page.waitForFunction(() => Engine.out.gain.value < .001);
  await page.keyboard.press("Tab"); await page.keyboard.press("Space");
  assert.equal(await page.locator("#sleep").getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => isAmbient()), true);
  await page.keyboard.press("Space"); assert.equal(await page.locator("#sleep").getAttribute("aria-pressed"), "false");
  record("First-screen action, visible focus, keyboard volume/mute/Sleep mode", firstScreen);
  await page.close();

  ({ page, fixture } = await open({ failStatus: true, failSettlements: true }));
  assert.equal(await page.locator("#badge").textContent(), "offline demo");
  assert.match(await page.locator("#chartNote").textContent(), /demo data/);
  await page.locator("#play").click();
  assert.equal(await page.evaluate(() => S.playing), true);
  fixture.failStatus = false; fixture.failSettlements = false;
  await page.evaluate(() => pollStatus());
  assert.equal(await page.locator("#badge").textContent(), "live");
  assert.equal(await page.evaluate(() => S.demo), false);
  record("First-load failure is labeled offline demo and recovers to live without stopping audio", { recovered: true });
  await page.close();
  assert.deepEqual(scriptErrors, []);
  record("No uncaught page-script errors during the fixture scenarios", { count: scriptErrors.length });
} catch (e) {
  results.push({ name: "Browser validation", passed: false, error: e.message });
  console.error(e.message); process.exitCode = 1;
} finally {
  await browser?.close(); await new Promise(done => server.close(done));
  await mkdir(resolve(reportPath, ".."), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ fixtureData: true, results }, null, 2) + "\n");
}
