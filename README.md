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
- **Running** (`SPINNING`, fresh data): kick, off-beat hi-hat, triangle bass on the chord root,
  detuned saw pad and a triangle pluck melody. Tempo is `70 + clamp(rpm/60) × 58` BPM, smoothed.
  The lowpass runs from 800 to 4000 Hz with rpm.
- **Sleeping** (`IDLE`, stale data, or Sleep mode): drums, bass and melody fade out over 4 s. What
  remains is a slow Am9/Fmaj7 pad, soft wind noise and a rare bell every 6 to 10 s at 60 BPM.
- **Mood** comes from work gained in the last 10 minutes. 0 is Nap (no melody, softer drums). 1 to
  99 is Journey (40% note density). 100 or more is Storm (70% density, octave arpeggio, heavy bass
  with a sine sub). Until the page has 10 minutes of its own samples, it also estimates from the
  last full 24h bucket.
- **Blocks**: the chords follow `blockHeight % 4`, and the melody comes from `mulberry32(blockHeight)`.
  A new block plays a 1 s noise riser and starts a new song at the next bar.
- **Work clicks**: each rise in `cumulativeWorkUnits` plays a short 1200 Hz click with a random pan.
- **Failures**: on a fetch error the page keeps the last values, shows "reconnecting" and keeps the
  music going. Data older than `staleAfterSeconds` shows "data stale" and fades to ambient. If the
  very first load fails, a labeled "offline demo" runs, with demo chart data, until the API answers.

## Validation status

Read `artifacts/validation.md` before relying on this build. The shell sandbox on the build machine
failed to start for the whole session, and the browser tool had no browser installed. So
`npm run build`, `npm run check`, the design probe and every rendered or audio check were **not
run**. The files were written by hand, with `dist/` copied from `src/` the same way.
`npm run build && npm run check` should be the first thing run on a working machine.
