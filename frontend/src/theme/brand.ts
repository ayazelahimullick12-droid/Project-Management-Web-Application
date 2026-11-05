/**
 * BRAC branding tokens — the ONE place to change colours and fonts.
 *
 * Used by the web UI (written into CSS variables at startup, see applyBrand) and by every
 * export (PDF print view, DOCX, PPTX). `dark` holds the same tokens for dark mode.
 *
 * Colours were taken from brac.net and bracinternational.org. Replace them with BRAC's
 * official hex values when you have them. The font is Inter (bundled, works offline);
 * BRAC's websites use Helvetica Neue, which is the fallback.
 *
 * The web UI uses a glass look (like iOS and macOS): translucent panels over a soft coloured
 * background. `glass` holds those translucent values; the solid colours above are still used by
 * the exports (PDF, Word, PowerPoint), which need solid colours.
 */
export const brand = {
  primary: '#D10074', // BRAC magenta (buttons, links, active items)
  accent: '#EC008C', // brighter magenta (highlights)
  primarySoft: '#FCE7F3', // light magenta background
  ink: '#27281C', // main text colour (BRAC's near-black)
  green: '#008945', // success, signed, approved
  greenSoft: '#E6F4EC',
  canvas: '#F5F5F3', // page background
  surface: '#FFFFFF', // cards and panels
  surface2: '#FAFAF8', // sidebar, subtle panels
  line: '#E6E6E1', // borders
  muted: '#6B6C63', // secondary text
  font: '"Inter Variable", "Helvetica Neue", Helvetica, Arial, sans-serif',
  orgName: 'BRAC',
  appName: 'Project Management',
  unitName: 'Microfinance Programme · Technology Unit',
  dark: {
    primary: '#E8399A',
    accent: '#FF4FAE',
    primarySoft: 'rgba(232, 57, 154, 0.16)',
    ink: '#ECECE7',
    green: '#22A35F',
    greenSoft: 'rgba(34, 163, 95, 0.16)',
    canvas: '#0F0F0E',
    surface: '#181817',
    surface2: '#141413',
    line: '#2C2C29',
    muted: '#9B9C93',
  },
  // Web UI only. canvas = a light fill (hovers, chips), surface = translucent panels,
  // line = hairlines, paper = a solid panel colour (the selected part of a switch, text on dark
  // chips, avatar rings, and every panel in the Solid look).
  glass: {
    light: { canvas: 'rgb(120 120 128 / 0.10)', surface: 'rgb(255 255 255 / 0.66)', surface2: 'rgb(255 255 255 / 0.4)', line: 'rgb(60 60 67 / 0.13)', primarySoft: 'rgb(209 0 116 / 0.10)', greenSoft: 'rgb(0 137 69 / 0.11)', paper: '#FFFFFF' },
    dark: { canvas: 'rgb(255 255 255 / 0.07)', surface: 'rgb(44 44 50 / 0.55)', surface2: 'rgb(255 255 255 / 0.04)', line: 'rgb(255 255 255 / 0.11)', primarySoft: 'rgb(232 57 154 / 0.18)', greenSoft: 'rgb(34 163 95 / 0.18)', paper: '#1C1C21' },
  },
} as const

type Palette = { primary: string; accent: string; primarySoft: string; ink: string; green: string; greenSoft: string; canvas: string; surface: string; surface2: string; line: string; muted: string }

/** The CSS variables for one palette, with the glass values on top. */
function tokens(t: Palette, g: Partial<Palette> & { paper: string }) {
  const v = { ...t, ...g }
  return `--brand-primary:${v.primary};--brand-accent:${v.accent};--brand-primary-soft:${v.primarySoft};--brand-ink:${v.ink};--brand-green:${v.green};--brand-green-soft:${v.greenSoft};--brand-canvas:${v.canvas};--surface:${v.surface};--surface-2:${v.surface2};--brand-line:${v.line};--brand-muted:${v.muted};--paper:${g.paper};`
}

/** Writes the tokens into CSS variables so Tailwind classes like `bg-brand` use them (light and dark). */
export function applyBrand() {
  let el = document.getElementById('brand-tokens')
  if (!el) {
    el = document.createElement('style')
    el.id = 'brand-tokens'
    document.head.appendChild(el)
  }
  el.textContent = `:root{${tokens(brand, brand.glass.light)}--brand-font:${brand.font};}.dark{${tokens(brand.dark, brand.glass.dark)}}`
}
