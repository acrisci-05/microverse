import { lazy, Suspense } from 'react'
import type { Quality, WorldState } from '../types/world'
const Planet = lazy(() => import('../three/Planet').then((module) => ({ default: module.Planet })))
export function PlanetView({
  seed,
  state,
  quality,
  className = '',
  showControls = true,
  interactive = true,
  onRegionSelect,
}: {
  seed: string
  state: WorldState
  quality: Quality
  className?: string
  showControls?: boolean
  interactive?: boolean
  onRegionSelect?: (description: string) => void
}) {
  return (
    <div className={`planet-view ${className}`}>
      <Suspense
        fallback={
          <div className="planet-loading">
            <span />
            <p>Gathering stardust…</p>
          </div>
        }
      >
        <Planet
          seed={seed}
          state={state}
          quality={quality}
          showControls={showControls}
          interactive={interactive}
          onRegionSelect={onRegionSelect}
        />
      </Suspense>
    </div>
  )
}
