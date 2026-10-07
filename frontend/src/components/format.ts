/** Date and time formatting in Bangladesh time. */

const TZ = 'Asia/Dhaka'

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "3 hours", "2 days" … */
export function duration(ms: number): string {
  const m = Math.round(Math.abs(ms) / 60000)
  if (m < 1) return 'less than a minute'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'}`
}

export function ago(iso: string | undefined, now: Date): string {
  if (!iso) return ''
  const diff = now.getTime() - new Date(iso).getTime()
  return diff >= 0 ? `${duration(diff)} ago` : `in ${duration(diff)}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`
}
