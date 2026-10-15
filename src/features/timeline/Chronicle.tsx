import { ArrowRight, Clock3, Radio, X } from 'lucide-react'
import { useState } from 'react'
import { PlanetThumbnail } from '../../three/PlanetThumbnail'
import type { ChronicleEntry, WorldRecord } from '../../types/world'

export function Chronicle({
  world,
  selected,
  onSelect,
}: {
  world: WorldRecord
  selected: ChronicleEntry | null
  onSelect: (entry: ChronicleEntry | null) => void
}) {
  const [visibleCount, setVisibleCount] = useState(6)
  const entries = world.chronicle.slice(-visibleCount).reverse()
  return (
    <section className="chronicle" aria-labelledby="chronicle-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">NOTHING STAYS STILL</p>
          <h2 id="chronicle-title">
            World chronicle<span className="count-label">{world.chronicle.length} moments</span>
          </h2>
        </div>
        {selected ? (
          <button className="button button-small" onClick={() => onSelect(null)}>
            <Radio size={15} />
            Return to the living world
            <X size={15} />
          </button>
        ) : (
          <p>
            Every world tells a story.
            <br />
            These are the moments that shaped yours.
          </p>
        )}
      </div>
      <div className="chronicle-track">
        {entries.map((entry) => (
          <button
            key={entry.id}
            className={`chronicle-entry tone-${entry.tone} ${selected?.id === entry.id ? 'selected' : ''}`}
            onClick={() => onSelect(selected?.id === entry.id ? null : entry)}
            aria-pressed={selected?.id === entry.id}
          >
            <div className="chronicle-cycle">
              <Clock3 size={13} />
              CYCLE {String(entry.cycle).padStart(3, '0')}
              <span />
            </div>
            <div className="chronicle-content">
              <PlanetThumbnail seed={world.seed} state={entry.snapshot} size={76} />
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
              </div>
            </div>
            <div className="chronicle-impact">
              {entry.impact}
              <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>
      {visibleCount < world.chronicle.length && (
        <button
          className="button button-small chronicle-more"
          onClick={() => setVisibleCount((count) => count + 12)}
        >
          Earlier moments · {world.chronicle.length - visibleCount} more
        </button>
      )}
      {selected && (
        <div className="snapshot-detail" role="status">
          <div>
            <p className="eyebrow">HISTORICAL SNAPSHOT / CYCLE {selected.cycle}</p>
            <h3>{selected.title}</h3>
            <p>
              {selected.description} {selected.impact}
            </p>
          </div>
          <dl>
            <div>
              <dt>Temperature</dt>
              <dd>{selected.snapshot.temperature.toFixed(1)}°C</dd>
            </div>
            <div>
              <dt>Vegetation</dt>
              <dd>{Math.round(selected.snapshot.vegetation)}%</dd>
            </div>
            <div>
              <dt>Biodiversity</dt>
              <dd>{Math.round(selected.snapshot.biodiversity)}%</dd>
            </div>
            <div>
              <dt>Stability</dt>
              <dd>{Math.round(selected.snapshot.stability)}%</dd>
            </div>
          </dl>
          <p>Read-only memory. Returning to the living world preserves your current progress.</p>
        </div>
      )}
    </section>
  )
}
