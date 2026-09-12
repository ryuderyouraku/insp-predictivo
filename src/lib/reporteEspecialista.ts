/**
 * New reports link 1-3 real Users as `especialistas`; older reports only have the legacy
 * free-text `especialista` column. Every reader picks whichever is populated instead of
 * assuming one or the other.
 */
export function especialistaLabel(reporte: { especialista: string | null; especialistas: { name: string }[] }): string {
  if (reporte.especialistas.length > 0) return reporte.especialistas.map((u) => u.name).join(', ')
  return reporte.especialista ?? '—'
}
