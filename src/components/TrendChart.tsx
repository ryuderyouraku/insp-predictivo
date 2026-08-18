'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { CriterioAceptacion } from '@prisma/client'
import type { PoleaHistorico } from '@/lib/historico'

export function TrendChart({ polea, criterios = [] }: { polea: PoleaHistorico; criterios?: CriterioAceptacion[] }) {
  const data = polea.lecturas.map((lectura) => ({
    fecha: new Date(lectura.fecha).toLocaleDateString('es-PE'),
    izquierda: lectura.tempIzquierda,
    derecha: lectura.tempDerecha,
  }))

  const umbrales = [...criterios]
    .filter((c) => c.nivel !== 'INACEPTABLE')
    .sort((a, b) => a.tempMax - b.tempMax)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-medium text-gray-900">
        Polea {polea.numero}{polea.tipo ? ` — ${polea.tipo}` : ''}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {umbrales.map((c) => (
            <ReferenceLine
              key={c.id}
              y={c.tempMax}
              stroke={c.color}
              strokeDasharray="4 4"
              label={{ value: c.nivel, position: 'insideTopRight', fontSize: 10, fill: c.color }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="izquierda"
            name="Lado izquierdo"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="derecha"
            name="Lado derecho"
            stroke="#ea580c"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
