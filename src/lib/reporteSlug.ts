const REPORTE_TZ = 'America/Lima'

function formatParts(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', ...opts })
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >
}

// `fecha` is a date-only value: the form sends "YYYY-MM-DD" and `new Date(...)`
// parses that as UTC midnight, so the calendar date must be read back in UTC —
// reading it in Lima time (UTC-5) would roll it back to the previous day.
function dateOnlyPart(fecha: Date): string {
  const p = formatParts(fecha, 'UTC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${p.year}${p.month}${p.day}`
}

// `createdAt` is a real timestamp, so the time-of-day is read in the
// business's local timezone (Peru).
function timeOnlyPart(createdAt: Date): string {
  const p = formatParts(createdAt, REPORTE_TZ, { hour: '2-digit', minute: '2-digit' })
  return `${p.hour}${p.minute}`
}

function sanitizeTag(tag: string): string {
  return tag.trim().replace(/[^a-zA-Z0-9-]+/g, '-')
}

/**
 * Reportes only store an inspection date (no time), so the human-friendly
 * identifier pairs that date with the time the record was created —
 * tag + fecha + hora, e.g. "FJ-01-20260822-1430".
 */
export function buildReporteSlug(tag: string, fecha: Date, createdAt: Date): string {
  return `${sanitizeTag(tag)}-${dateOnlyPart(fecha)}-${timeOnlyPart(createdAt)}`
}

export interface ParsedReporteSlug {
  tag: string
  date8: string
  time4: string
}

export function parseReporteSlug(slug: string): ParsedReporteSlug | null {
  const match = /^(.+)-(\d{8})-(\d{4})$/.exec(slug)
  if (!match) return null
  const [, tag, date8, time4] = match
  return { tag, date8, time4 }
}

export function reporteMatchesSlugParts(
  parsed: ParsedReporteSlug,
  reporte: { fecha: Date; createdAt: Date }
): boolean {
  return dateOnlyPart(reporte.fecha) === parsed.date8 && timeOnlyPart(reporte.createdAt) === parsed.time4
}
