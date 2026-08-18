import type { Condicion } from '@prisma/client'
import { CONDICION_LABELS, CONDICION_STYLES } from '@/lib/condicion'

export function CondicionBadge({ condicion }: { condicion: Condicion }) {
  const style = CONDICION_STYLES[condicion]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: style.soft, color: style.text, border: `1px solid ${style.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.solid }} />
      {CONDICION_LABELS[condicion]}
    </span>
  )
}
