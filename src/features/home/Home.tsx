import { ArrowDown, ArrowRight, ChevronRight, Circle, Globe2, Orbit, Sparkles } from 'lucide-react'
import { createWorld } from '../../engine'
import { PlanetView } from '../../components/PlanetView'
import { PlanetThumbnail } from '../../three/PlanetThumbnail'
import { BLUEPRINTS } from '../../data/blueprints'
import { copy } from '../../data/copy'
import type { Quality, WorldInput } from '../../types/world'

const previewWorlds = BLUEPRINTS.map((blueprint) => createWorld(blueprint, blueprint.seed, 0))

export function Home({
  onCreate,
  onExplore,
  quality,
}: {
  onCreate: (blueprint?: WorldInput) => void
  onExplore: () => void
  quality: Quality
}) {
  const sample = previewWorlds[0]
  return (
    <main id="main" className="home page-enter">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-coordinate" aria-hidden="true">
          SECTOR 07 / ORIGIN UNKNOWN
        </div>
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star">✧</span>
            {copy.home.eyebrow}
          </p>
          <h1 id="hero-title">
            A tiny planet.
            <br />
            Endless
            <br />
            <span>consequences.</span>
          </h1>
          <p className="hero-description">{copy.home.lead}</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => onCreate()}>
              {copy.home.create}
              <ArrowUpRight />
            </button>
            <button className="button button-text" onClick={onExplore}>
              {copy.home.explore}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-note">
            <span className="status-dot" />A living world. Shaped by you.
          </div>
        </div>
        <div className="hero-scene">
          <div className="orbital-ring orbit-one" />
          <div className="orbital-ring orbit-two" />
          <PlanetView
            seed={sample.seed}
            state={sample.state}
            quality={quality}
            showControls={false}
          />
          <div className="planet-callout callout-north">
            <span className="callout-cross">+</span>
            <span>
              EVERYTHING IS CONNECTED<small>One small change. A different world.</small>
            </span>
          </div>
          <div className="planet-callout callout-south">
            <span className="callout-line" />
            <span>
              VERDANT — 07<small>A world of possibility</small>
            </span>
          </div>
          <span className="drag-hint">
            <Orbit size={13} />
            Drag to discover
          </span>
        </div>
        <button
          className="scroll-cue"
          onClick={() =>
            document.getElementById('possibilities')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <ArrowDown size={15} />
          SCROLL TO EXPLORE
        </button>
        <div className="hero-edition">
          A PERSONAL UNIVERSE<span>EST. CYCLE 000</span>
        </div>
      </section>
      <section className="game-principles" aria-label="How to play">
        <div>
          <span className="principle-number">01</span>
          <Globe2 size={21} />
          <div>
            <h3>Shape a world.</h3>
            <p>Find the balance between water, warmth, and light.</p>
          </div>
        </div>
        <div>
          <span className="principle-number">02</span>
          <Sparkles size={21} />
          <div>
            <h3>Give life a chance.</h3>
            <p>Nurture an ecosystem. Every intervention matters.</p>
          </div>
        </div>
        <div>
          <span className="principle-number">03</span>
          <Orbit size={21} />
          <div>
            <h3>See what becomes.</h3>
            <p>Follow the unexpected story of your creation.</p>
          </div>
        </div>
      </section>
      <section className="possibilities section-wrap" id="possibilities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NO TWO WORLDS ALIKE</p>
            <h2>Start with a possibility.</h2>
          </div>
          <p>
            A quiet ocean. A frozen frontier.
            <br />
            Every beginning has a different future.
          </p>
        </div>
        <div className="blueprint-grid">
          {BLUEPRINTS.slice(1).map((blueprint, index) => (
            <button key={blueprint.seed} className="blueprint" onClick={() => onCreate(blueprint)}>
              <span className="blueprint-index">0{index + 1} / ORIGIN</span>
              <PlanetThumbnail
                seed={blueprint.seed}
                state={previewWorlds[index + 1].state}
                size={260}
              />
              <div className="blueprint-bottom">
                <p className="eyebrow" style={{ color: blueprint.color }}>
                  {blueprint.label}
                </p>
                <h3>
                  {blueprint.name}
                  <ChevronRight size={21} />
                </h3>
                <p>{blueprint.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <footer className="site-footer">
        <span>
          <Circle size={9} />
          SMALL WORLDS. REAL CONSEQUENCES.
        </span>
        <span>Built for curiosity. Saved on your device.</span>
        <span>MICROVERSE / 001</span>
      </footer>
    </main>
  )
}
function ArrowUpRight() {
  return (
    <svg viewBox="0 0 20 20" width="19" height="19" fill="none" aria-hidden="true">
      <path d="M4 16 16 4M4 4h12v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
