import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { PlanetThumbnail } from '../../three/PlanetThumbnail'
import type { WorldRecord, WorldState } from '../../types/world'

const metrics: { key: keyof WorldState; label: string; unit: string }[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'water', label: 'Ocean coverage', unit: '%' },
  { key: 'vegetation', label: 'Vegetation', unit: '%' },
  { key: 'biodiversity', label: 'Biodiversity', unit: '%' },
  { key: 'stability', label: 'Ecological stability', unit: '%' },
  { key: 'civilization', label: 'Civilization', unit: '%' },
  { key: 'cycle', label: 'Cycles elapsed', unit: '' },
]
export function Compare({ worlds, onBack }: { worlds: WorldRecord[]; onBack: () => void }) {
  const [aId, setA] = useState(worlds[0]?.id)
  const [bId, setB] = useState(worlds[1]?.id)
  const a = worlds.find((w) => w.id === aId) ?? worlds[0]
  const b = worlds.find((w) => w.id === bId) ?? worlds[1]
  if (!a || !b)
    return (
      <main id="main" className="section-wrap">
        <h1>Two worlds. Two stories.</h1>
        <p>Create at least two worlds to compare their evolution.</p>
        <button className="button" onClick={onBack}>
          My universe
        </button>
      </main>
    )
  return (
    <main id="main" className="compare page-enter section-wrap">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        My universe
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A DIFFERENT CHOICE. A DIFFERENT FUTURE.</p>
          <h1>Worlds, side by side.</h1>
          <p>Compare the real conditions of your saved worlds.</p>
        </div>
      </div>
      <div className="compare-planets">
        {[
          { world: a, set: setA, label: 'World A', other: b.id },
          { world: b, set: setB, label: 'World B', other: a.id },
        ].map(({ world, set, label, other }) => (
          <div key={label}>
            <label>
              {label}
              <select
                aria-label={label}
                value={world.id}
                onChange={(event) => set(event.target.value)}
              >
                {worlds.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === other}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <PlanetThumbnail seed={world.seed} state={world.state} size={300} />
            <h2>{world.name}</h2>
            <p>SEED / {world.seed}</p>
          </div>
        ))}
      </div>
      <table className="comparison-table">
        <caption className="sr-only">
          Planet conditions for {a.name} and {b.name}
        </caption>
        <thead>
          <tr>
            <th scope="col">Planetary indicator</th>
            <th scope="col">{a.name}</th>
            <th scope="col">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key}>
              <th scope="row">{metric.label}</th>
              <td>
                {Math.round(Number(a.state[metric.key]))}
                {metric.unit}
              </td>
              <td>
                {Math.round(Number(b.state[metric.key]))}
                {metric.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
