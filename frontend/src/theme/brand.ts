/**
 * BRAC branding tokens — the ONE place to change colours and fonts.
 *
 * Used by the web UI (written into CSS variables at startup, see applyBrand) and by every
 * export (PDF print view, DOCX, PPTX). `dark` holds the same tokens for dark mode.
 *
 * Colours were taken from brac.net and bracinternational.org. Replace them with BRAC's
 * official hex values when you have them. The font is Inter (bundled, works offline);
 * BRAC's websites use Helvetica Neue, which is the fallback.
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
} as const

function tokens(t: { primary: string; accent: string; primarySoft: string; ink: string; green: string; greenSoft: string; canvas: string; surface: string; surface2: string; line: string; muted: string }) {
  return `--brand-primary:${t.primary};--brand-accent:${t.accent};--brand-primary-soft:${t.primarySoft};--brand-ink:${t.ink};--brand-green:${t.green};--brand-green-soft:${t.greenSoft};--brand-canvas:${t.canvas};--surface:${t.surface};--surface-2:${t.surface2};--brand-line:${t.line};--brand-muted:${t.muted};`
}

/** Writes the tokens into CSS variables so Tailwind classes like `bg-brand` use them (light and dark). */
export function applyBrand() {
  let el = document.getElementById('brand-tokens')
  if (!el) {
    el = document.createElement('style')
    el.id = 'brand-tokens'
    document.head.appendChild(el)
  }
  el.textContent = `:root{${tokens(brand)}--brand-font:${brand.font};}.dark{${tokens(brand.dark)}}`
}
