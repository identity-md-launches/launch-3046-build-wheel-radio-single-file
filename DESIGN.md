# Wheel Radio design

Wheel Radio is a vintage pixel-art radio drawn as one centered card. It plays live generative music
driven by Squeektoshi the hamster's wheel. Everything below comes from `src/index.html`, the only
source file. `dist/index.html` is a byte copy of it.

## Direction

- A warm lofi radio on a starry night sky. The card is the radio body. Its parts, from top to
  bottom: brand and tuning dial, status, a wheel with a Play button, speaker grille, LCD, stats,
  controls, chart.
- State drives the palette. **Running** uses gold and amber accents (`body.is-running`).
  **Sleeping or stale** uses teal and cool navy (`body.is-sleeping`). Colors transition over 300ms.
- Pixel-art details: square-cornered inner panels (4px radius), crisp-edged SVG art
  (`shape-rendering="crispEdges"`), stepped animations (`steps()`), and pixel bars on the
  visualizer and progress bar.

## Color tokens (`:root`)

| Token | Value | Role |
| --- | --- | --- |
| `--navy` | `#0F1020` | page sky, icon ink on the gold Play button |
| `--ink` | `#1A1A20` | radio body surface |
| `--gold` | `#F2C14E` | brand, Play button, running accent |
| `--amber` | `#FF9F43` | LCD text, dial needle, current chart bar, visualizer |
| `--cream` | `#F6E7C1` | primary text, focus ring (`--focus`) |
| `--teal` | `#4ECDC4` | sleeping accent, live badge, pressed toggle LED |
| `--muted` | `#C9BC9A` | secondary text on `--ink` |
| `--line` | `#3A3550` | inner borders, chart baseline |
| `--screen` / `--screen-line` | `#130F09` / `#4A3516` | LCD glass and bezel |
| `--accent` | gold, or teal when sleeping | card border, section titles, wheel rim, chart bars, links |
| `--glow` | gold or teal at about 50% alpha | brand and Play glow |
| `--sky` | `#0F1020`, or `#0A0E22` when sleeping | body background color |

Exactly one control is filled: the gold Play button. The badge states pair color with text
(`live`, `data stale`, `reconnecting`, `data stale · reconnecting`, `offline demo`, `connecting`) and with a filled or hollow
square marker, so color is never the only signal.

## Typography

| Family | Token | Used for |
| --- | --- | --- |
| "Press Start 2P", monospace fallback | `--font-display` | brand `h1`, section `h2` titles, sleeping "zzz" |
| "VT323", monospace fallback | `--font-num` | numbers: dial scale, BPM, LCD lines, stat values |
| system-ui stack | `--font-ui` | body copy, labels, buttons, footer |

The brief names Press Start 2P and VT323. Sentences use a system sans so that no prose line is set
in a monospace face. The fonts load from Google Fonts (`display=swap`); if that fails, the monospace
fallbacks render.

The revision's Chromium screenshots use those fallbacks: Google Fonts returned
`net::ERR_EMPTY_RESPONSE`. The intended font faces were not verified in the browser.

The type scale has four sizes, all weight 400:

| Token | Size | Roles |
| --- | --- | --- |
| `--fs-xs` | 12px | section titles, badge, stat labels, chart axis, footer |
| `--fs-sm` | 14px | body (root text size), status, hint, buttons, chart note |
| `--fs-md` | 20px | brand, dial numbers, BPM, LCD |
| `--fs-lg` | 24px | stat values |

Changing numbers use `font-variant-numeric: tabular-nums`. No letter-spacing is applied. The brand
is the only uppercase text, and it sits in the header.

## Spacing, radius and motion

- Spacing tokens: `--space-1` to `--space-6` = 4, 8, 12, 16, 24, 32px. The card gap is 24px (16px
  at 360px wide or less).
- Radius: `--radius-card` 16px on the radio body only. `--radius-px` 4px on the inner panels (dial,
  grille, LCD, buttons, badge). The status pill is fully round.
- Borders are 2px. The card has no drop shadow: depth comes from borders and glow, never both on
  one surface.
- Motion: `--t` is 300ms ease, used for color, border and fill. The wheel rotates at the real RPM
  through `requestAnimationFrame` (`rpm × 6` degrees per second). The hamster's legs alternate at a
  rate tied to RPM. Stars twinkle and the "zzz" drifts only under
  `prefers-reduced-motion: no-preference`. With reduced motion, the wheel, legs, needle easing and
  stars all stay still; the visualizer keeps drawing audio levels.

## Components

1. **Header** (`.top`): glowing gold `h1` "WHEEL RADIO", tagline "listen to the chain breathe",
   and a tuning dial (`.dial`) with tick strip, scale (88, FM 88.8, 98, 108) and an amber needle at
   `left: 4% + clamp(rpm/60) × 92%`.
2. **Status** (`.status`): a pill with a glowing square dot and "Squeektoshi is running · N RPM",
   "Squeektoshi is sleeping" or "Waiting for fresh wheel data". Below it sit the BPM readout and
   the connection badge.
3. **Stage** (`.stage`, up to 264px square): a pixel wheel SVG (rim, inner rim, 16 rungs, 6 spokes,
   hub) generated on a 64×64 grid, with a 14×9 pixel hamster, a CSS crescent moon and "zzz" while
   sleeping. The round gold **Play/Pause** button (38% of the stage, at least 88px) is centered and
   swaps a pixel play or pause icon and its `aria-label`. A hint line sits under the stage.
   `.stage` and `.sky` use `overflow: clip` to contain rotating SVG bounds and decorative stars.
   The Play button and its focus ring fit inside this boundary at the existing size and position.
   A failed Play keeps its blocked-audio recovery hint; a successful pause shows the paused hint.
4. **Speaker grille** (`.grille`): dotted grille background with a 96px canvas. It draws mirrored
   pixel bars from the AnalyserNode with an amber-gold-amber gradient and a soft glow.
5. **Now playing LCD** (`.lcd`): track "Block 1,140 · Night Shift" (seeded word lists), mood, chord,
   song percentage and a segmented progress bar (`role="progressbar"`, from `blockProgress / 1e9`).
6. **Stats** (`.stats`, a `dl`): total work, block height, km run (`distanceMm / 1e6`). Values sit
   above their labels by `column-reverse`, so screen readers still read the label first.
7. **Controls** (`.controls`): decorative knob (rotates from -135° to 135° with the volume), a native
   labeled range input (44px tall), a Mute/Unmute button, and a Sleep mode toggle (`aria-pressed`
   with an LED square).
8. **Chart**: inline SVG bars for the 24h buckets (current bucket in amber, each bar with a
   `<title>`), axis labels "24 h ago" and "now", and a summary line, also used as the SVG
   `aria-label`.
   Zero-work buckets have zero-height data bars and a zero maximum in the summary; the baseline
   remains visible. Positive values retain their proportional scaling and one-pixel minimum.
9. **Footer** (`.foot`): squeekchain.com link and "Read-only · no wallet · near real-time · community
   project".

Accessibility parts: a visually hidden `h2#summary` restates the station state, a
`role="status"` region announces only changes in running/sleeping or feed state, and focus rings
are a 3px cream outline (8px offset on Play). Forced-colors mode adds system-color borders.

## Responsive behavior

- Mobile first. The body pads 16px top and 12px sides (8px at 360px or less). The card is `max-width:
  480px` and centered, so at 1440px it stays a 480px radio on the starry background.
- Inner card padding is 16px below 400px, 24px from 400px up, and 12px at 360px or less.
- At 390×844 the first screen shows the brand, dial, status and the whole wheel with the Play button.
  This was inspected in a Chromium screenshot, including a visible keyboard focus ring
  (see `artifacts/validation.md`). Reflow was measured at 320, 390 and 1440px, including 24 wheel
  angles at each width; none produced horizontal scrolling. Native zoom was not tested.
- The stage width is `min(264px, 100%)`. The controls row wraps: volume takes at least 180px, then
  Mute and Sleep mode wrap below. Stat values may break anywhere instead of overflowing.
- The canvas is resized to its CSS width × devicePixelRatio (capped at 2) on window resize.
