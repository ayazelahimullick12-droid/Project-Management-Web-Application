/**
 * BRAC branding tokens — the ONE place to change colours and fonts.
 *
 * Used by the web UI (copied into CSS variables at startup, see applyBrand)
 * and by every export (PDF print view, DOCX, PPTX).
 *
 * Colours were taken from brac.net and bracinternational.org.
 * Replace them with BRAC's official hex values when you have them.
 */
export const brand = {
  primary: '#D10074', // BRAC magenta (buttons, links, active items)
  accent: '#EC008C', // brighter magenta (highlights)
  primarySoft: '#FCE7F3', // light magenta background
  ink: '#27281C', // main text colour (BRAC's near-black)
  green: '#008945', // success, signed, approved
  greenSoft: '#E6F4EC',
  canvas: '#F6F6F6', // page background
  line: '#E3E3DE', // borders
  muted: '#6B6C63', // secondary text
  font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  orgName: 'BRAC',
  appName: 'Project Management',
  unitName: 'Microfinance Programme · Technology Unit',
} as const

/** Copies the tokens into CSS variables so Tailwind classes like `bg-brand` use them. */
export function applyBrand() {
  const root = document.documentElement.style
  root.setProperty('--brand-primary', brand.primary)
  root.setProperty('--brand-accent', brand.accent)
  root.setProperty('--brand-primary-soft', brand.primarySoft)
  root.setProperty('--brand-ink', brand.ink)
  root.setProperty('--brand-green', brand.green)
  root.setProperty('--brand-green-soft', brand.greenSoft)
  root.setProperty('--brand-canvas', brand.canvas)
  root.setProperty('--brand-line', brand.line)
  root.setProperty('--brand-muted', brand.muted)
  root.setProperty('--brand-font', brand.font)
}
