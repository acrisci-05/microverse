import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Dna,
  Droplets,
  RotateCcw,
  Shuffle,
  Sun,
  Thermometer,
  Weight,
} from 'lucide-react'
import { createWorld } from '../../engine'
import { PlanetView } from '../../components/PlanetView'
import { BLUEPRINTS } from '../../data/blueprints'
import type { Quality, WorldInput, WorldParameters } from '../../types/world'

const parameters = [
  {
    key: 'water',
    label: 'Water coverage',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    icon: Droplets,
    help: 'Oceans feed the rain. Too much water leaves less land for life.',
  },
  {
    key: 'temperature',
    label: 'Average temperature',
    unit: '°C',
    min: -50,
    max: 80,
    step: 1,
    icon: Thermometer,
    help: 'Warmth awakens life. Extremes turn forests into ice or desert.',
  },
  {
    key: 'solar',
    label: 'Solar energy',
    unit: '%',
    min: 20,
    max: 160,
    step: 1,
    icon: Sun,
    help: 'Sunlight powers growth and gradually shifts the climate.',
  },
  {
    key: 'gravity',
    label: 'Gravity',
    unit: 'g',
    min: 0.3,
    max: 2,
    step: 0.1,
    icon: Weight,
    help: 'Gravity shapes atmospheric retention and the cost of animal life.',
  },
  {
    key: 'lifePotential',
    label: 'Initial life potential',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    icon: Dna,
    help: 'The first spark: initial fertility, vegetation, and diversity.',
  },
] as const

export function Creator({
  initial,
  quality,
  onBegin,
  onBack,
}: {
  initial: WorldInput
  quality: Quality
  onBegin: (input: WorldInput) => void
  onBack: () => void
}) {
  const [input, setInput] = useState<WorldInput>(initial)
  const [expanded, setExpanded] = useState(true)
  const preview = useMemo(() => createWorld(input), [input])
  const change = (key: keyof WorldParameters, value: number) =>
    setInput((current) => ({ ...current, [key]: value }))
  return (
    <main id="main" className="creator page-enter section-wrap">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to the universe
      </button>
      <div className="creator-title">
        <div>
          <p className="eyebrow">WORLD GENESIS / 001</p>
          <h1>
            An idea. <span>A new world.</span>
          </h1>
        </div>
        <p>
          Set the conditions.
          <br />
          Let possibility do the rest.
        </p>
      </div>
      <div className="creator-layout">
        <form
          className="creation-panel"
          onSubmit={(event) => {
            event.preventDefault()
            onBegin({
              ...input,
              name: input.name.trim() || 'Unnamed world',
              seed: input.seed.trim() || 'microverse',
            })
          }}
        >
          <div className="panel-step">
            <span>01</span>
            <span>NAME YOUR WORLD</span>
          </div>
          <label className="sr-only" htmlFor="world-name">
            World name
          </label>
          <input
            className="world-name-input"
            id="world-name"
            maxLength={40}
            value={input.name}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
            placeholder="A name for the unknown"
            required
          />
          <div className="panel-step shape-step">
            <span>02</span>
            <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
              SHAPE THE ENVIRONMENT<span>{expanded ? '−' : '+'}</span>
            </button>
          </div>
          <div className={`parameter-list ${expanded ? '' : 'collapsed'}`}>
            {parameters.map(({ key, label, unit, min, max, step, icon: Icon, help }) => (
              <div className="parameter" key={key}>
                <div className="parameter-heading">
                  <label htmlFor={key}>
                    <Icon size={15} />
                    {label}
                  </label>
                  <output htmlFor={key}>
                    {key === 'gravity' ? input[key].toFixed(1) : input[key]}
                    <span>{unit}</span>
                  </output>
                </div>
                <input
                  id={key}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={input[key]}
                  onChange={(event) => change(key, Number(event.target.value))}
                  aria-describedby={`${key}-hint`}
                  style={
                    {
                      '--range-fill': `${((input[key] - min) / (max - min)) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <p id={`${key}-hint`}>{help}</p>
              </div>
            ))}
          </div>
          <details className="seed-details">
            <summary>
              World seed <span>{input.seed}</span>
            </summary>
            <div>
              <label htmlFor="seed">Same seed. Same beginning.</label>
              <div className="input-with-button">
                <input
                  id="seed"
                  maxLength={64}
                  required
                  value={input.seed}
                  onChange={(event) => setInput({ ...input, seed: event.target.value })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Generate a new seed"
                  onClick={() => setInput({ ...input, seed: crypto.randomUUID().slice(0, 12) })}
                >
                  <Shuffle size={17} />
                </button>
              </div>
            </div>
          </details>
          <button type="submit" className="button button-primary begin-button">
            Begin evolution
            <ArrowRight size={18} />
          </button>
          <p className="local-note">Your world is automatically saved on this device.</p>
        </form>
        <div className="creator-preview">
          <div className="preview-topline">
            <span className="eyebrow">03 / LIVE PREVIEW</span>
            <span className="live-badge">
              <span className="status-dot" />
              FORMING
            </span>
          </div>
          <PlanetView seed={input.seed} state={preview.state} quality={quality} />
          <div className="preview-name">
            <span className="eyebrow">A WORLD NOT YET WRITTEN</span>
            <h2>{input.name || 'The unknown'}</h2>
            <span>
              {Math.round(preview.state.stability)}% initial stability · {input.water}% ocean
            </span>
          </div>
          <div className="preset-picker">
            <span>BEGIN WITH</span>
            {BLUEPRINTS.map((blueprint) => (
              <button
                key={blueprint.seed}
                type="button"
                className={input.seed === blueprint.seed ? 'selected' : ''}
                onClick={() => setInput({ ...blueprint, name: input.name })}
              >
                {blueprint.name}
              </button>
            ))}
            <button
              type="button"
              className="reset-preset"
              aria-label="Reset world parameters"
              onClick={() => setInput(initial)}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
