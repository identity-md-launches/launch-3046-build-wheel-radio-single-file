# Wheel Radio

Live generative lofi driven by Squeektoshi the hamster's real wheel on Squeekchain. It is a single
HTML file with inline CSS and JavaScript. It uses only the Web Audio API: no libraries, no audio
files, no backend and no wallet. It only reads data.

- Wheel status: `GET https://api.squeekchain.com/v1/status` every 5 s.
- 24h chart: `GET https://api.squeekchain.com/v1/settlements?range=24h` every 3 min.
- Fonts: Press Start 2P and VT323 from Google Fonts, with monospace fallbacks.

## Layout

| Path | What |
| --- | --- |
| `src/index.html` | the whole site: markup, CSS, JS |
| `src/og-image.svg` | share image |
| `dist/` | the production export, a byte copy of `src/` (committed; the publisher serves it as-is) |
| `scripts/build.mjs` | copies `src/` to `dist/`, fails on root-absolute URLs or missing share tags |
| `scripts/check.mjs` | syntax check, id check, dist-matches-src check, unit checks of the seeded music helpers |
| `scripts/browser-check.mjs` | optional Playwright regression checks using explicitly synthetic API fixtures |
| `scripts/preview.mjs` | local static server for `dist/` under `/preview/` |
| `DESIGN.md` | design tokens, type, components, responsive rules |
| `artifacts/validation.md` | review and verification record |

## Install, preview, rebuild

You need Node 18 or newer. There are no dependencies, so `npm install` only checks the empty
lockfile.

```sh
npm install          # optional, nothing to download
npm run build        # src/ -> dist/
npm run check        # also available as: npm run typecheck
npm run preview      # http://localhost:4173/preview/
```

Every URL is relative (`./og-image.svg`; the favicon is an inline data URI), so `dist/` works from
any subpath, IPFS gateway or ENS name. Opening `dist/index.html` directly from disk also works,
provided the browser allows `fetch` to the API from a `file:` page.

Tunables sit at the top of the script: `RPM_DIVISOR = 1000`, `STORM_WORK = 100`, the poll intervals,
`LOOKAHEAD_S = 0.2` and `TICK_MS = 25`.

## How it behaves

- **Play** creates the AudioContext, since browsers block autoplay. Space or Enter on the focused
  button works. Pause suspends the context.
- **Running** (`SPINNING`, fresh data, Journey or Storm): kick, off-beat hi-hat, triangle bass on the chord root,
  detuned saw pad and a triangle pluck melody. Tempo is `70 + clamp(rpm/60) × 58` BPM, smoothed.
  The lowpass runs from 800 to 4000 Hz with rpm.
- **Sleeping** (`IDLE`, stale data, or Sleep mode): drums, bass and melody fade out over 4 s. What
  remains is a slow Am9/Fmaj7 pad, soft wind noise and a rare bell every 6 to 10 s at 60 BPM.
- **Mood** comes from observed work gained in the last 10 minutes. 0 is Nap (chords only). 1 to
  99 is Journey (40% note density). 100 or more is Storm (70% density, octave arpeggio, heavy bass
  with a sine sub). During warm-up, only the cumulative-work samples collected since opening
  the page are used. The sample at or immediately before the ten-minute boundary is retained;
  hourly settlements are used only for the chart, never to estimate recent work.
- **Blocks**: the chords follow `blockHeight % 4`, and the melody comes from `mulberry32(blockHeight)`.
  A new block plays a 1 s noise riser and starts a new song at the next bar.
- **Work clicks**: each rise in `cumulativeWorkUnits` plays a short 1200 Hz click with a random pan.
- **Failures**: on a fetch error the page keeps the last values, shows "reconnecting" and keeps the
  music going. Data older than `staleAfterSeconds` shows "data stale" and fades to ambient. If the
  very first load fails, a labeled "offline demo" runs, with demo chart data, until the API answers.
  Expired data during a retry shows both states: "data stale · reconnecting".

## Validation status

The revision reproduced and fixed all six reported findings. Production build and the existing
`npm run typecheck` pass. For this JavaScript-only site, that script checks syntax, DOM IDs,
export equality and music helpers; it is not a TypeScript compiler. Chromium interaction checks
pass all nine groups, and the pinned taste@1 probe passes all 16 checks at 320, 390 and 1440px.
See `artifacts/validation.md`, `artifacts/browser-results.json` and `.imd-responses.json`.

To repeat the browser checks, supply an installed Playwright module and its Chromium browser
(these are optional development tools, not website dependencies):

```sh
node scripts/browser-check.mjs /path/to/playwright/index.mjs
```

It serves `dist/` at a local subpath, closes its browser/server on completion and writes results
and screenshots under `test/scratch/`. It mocks the API to make error, mood and timing states
repeatable; all such data is test data. No dependencies or browser binaries are bundled.

Limitations: the supplied browser tool could not launch; a separate temporary Playwright Chromium
installation performed the rendered checks. Live API and Google Fonts requests in that browser
returned `net::ERR_EMPTY_RESPONSE`, exercising the labeled offline demo and font fallbacks.
Both API URLs returned HTTP 200 using curl. Live browser integration and the intended font faces
remain unverified. Audio scheduling and gain changes were checked with real Web Audio nodes;
subjective listening, WebKit, a physical phone and a screen reader were not tested. No live
observations or results were fabricated.
