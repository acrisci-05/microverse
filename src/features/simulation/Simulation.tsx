import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Dna,
  Droplets,
  Leaf,
  Pause,
  Play,
  Share2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react'
import { PlanetView } from '../../components/PlanetView'
import { Metric } from '../../components/Metric'
import { actionIcons } from '../../data/iconMaps'
import { ACTIONS, ACHIEVEMENTS } from '../../data/ecology'
import { copy } from '../../data/copy'
import { worldStatus } from '../../engine'
import { Chronicle } from '../timeline/Chronicle'
import { NextChapter } from './NextChapter'
import { worldGuidance } from './guidance'
import type { ActionId, ChronicleEntry, Quality, WorldRecord } from '../../types/world'

export function Simulation({
  world,
  quality,
  autoRun,
  onTick,
  onAct,
  onBack,
  onShare,
  onDiscoveries,
  saveStatus,
}: {
  world: WorldRecord
  quality: Quality
  autoRun: boolean
  onTick: () => void
  onAct: (id: ActionId) => string | undefined
  onBack: () => void
  onShare: () => void
  onDiscoveries: () => void
  saveStatus: string
}) {
  const [running, setRunning] = useState(autoRun)
  const [speed, setSpeed] = useState(1)
  const [snapshot, setSnapshot] = useState<ChronicleEntry | null>(null)
  const [feedback, setFeedback] = useState('')
  const [region, setRegion] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [newAchievement, setNewAchievement] = useState('')
  const tickRef = useRef(onTick)
  const unlocked = useRef(world.achievements.length)
  tickRef.current = onTick
  useEffect(() => {
    if (!running || snapshot) return
    const id = window.setInterval(() => {
      if (!document.hidden) tickRef.current()
    }, 2400 / speed)
    return () => window.clearInterval(id)
  }, [running, speed, snapshot])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  useEffect(() => {
    if (world.achievements.length > unlocked.current) {
      const newest = world.achievements.at(-1)
      setNewAchievement(ACHIEVEMENTS.find((a) => a.id === newest)?.name ?? 'A new discovery')
    }
    unlocked.current = world.achievements.length
  }, [world.achievements])
  useEffect(() => {
    if (feedback) {
      const id = setTimeout(() => setFeedback(''), 5000)
      return () => clearTimeout(id)
    }
  }, [feedback])
  useEffect(() => {
    if (newAchievement) {
      const id = setTimeout(() => setNewAchievement(''), 6000)
      return () => clearTimeout(id)
    }
  }, [newAchievement])
  const state = snapshot?.snapshot ?? world.state
  const guidance = worldGuidance(world.state)
  const latest = snapshot ?? world.chronicle.at(-1)
  const selectSnapshot = (entry: ChronicleEntry | null) => {
    setSnapshot(entry)
    setRunning(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <main id="main" className="simulation page-enter section-wrap">
      <div className="simulation-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            My universe
          </button>
          <div className="world-title">
            <h1>{world.name}</h1>
            <span className={`world-status ${state.stability < 35 ? 'warning' : ''}`}>
              <span className="status-dot" />
              {worldStatus(state)}
            </span>
          </div>
        </div>
        <div className="simulation-heading-right">
          <span className="save-state">
            {saveStatus === 'saved' ? <Check size={13} /> : <Activity size={13} />}{' '}
            {saveStatus === 'saved'
              ? copy.save.saved
              : saveStatus === 'saving'
                ? 'Saving…'
                : 'Save unavailable'}
          </span>
          <button className="button button-small" onClick={onShare}>
            <Share2 size={15} />
            Share origin
          </button>
        </div>
      </div>
      {snapshot && (
        <div className="memory-banner">
          <span>
            {copy.simulation.history} Cycle {snapshot.cycle}.
          </span>
          <button onClick={() => setSnapshot(null)}>
            Return to present
            <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      <div className="simulation-stage">
        <aside className="world-vitals">
          <p className="eyebrow">
            <Activity size={13} />
            PLANETARY VITALS
          </p>
          <Metric
            label="Temperature"
            value={state.temperature}
            unit="°C"
            icon={Thermometer}
            color="amber"
          />
          <Metric label="Ocean coverage" value={state.water} icon={Droplets} color="blue" />
          <Metric label="Vegetation" value={state.vegetation} icon={Leaf} />
          <Metric label="Biodiversity" value={state.biodiversity} icon={Dna} />
          <button
            className="subtle-link"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? 'Fewer' : 'All'} indicators
            <ChevronDown size={13} />
          </button>
          {expanded && (
            <dl className="secondary-vitals">
              {[
                ['Humidity', state.humidity],
                ['Fertility', state.fertility],
                ['Animal life', state.animals],
                ['Resources', state.resources],
                ['Technology', state.technology],
                ['Civilization', state.civilization],
                ['Pollution', state.pollution],
                ['Solar energy', state.solar],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{Math.round(Number(value))}%</dd>
                </div>
              ))}
              <div>
                <dt>Gravity</dt>
                <dd>{state.gravity.toFixed(1)}g</dd>
              </div>
            </dl>
          )}
        </aside>
        <div className="living-planet">
          <div className="planet-stage-label">
            <span className="eyebrow">{snapshot ? 'A MOMENT PRESERVED' : 'YOUR LIVING WORLD'}</span>
            <span className="seed-label">SEED / {world.seed}</span>
          </div>
          <PlanetView
            seed={world.seed}
            state={state}
            quality={quality}
            onRegionSelect={setRegion}
          />
          <div className="cycle-pulse" key={state.cycle} />
          {region && (
            <button
              className="region-info"
              onClick={() => setRegion('')}
              aria-label="Dismiss region information"
            >
              {region}
              <span>×</span>
            </button>
          )}
          <div className="planet-cycle">
            <span className="eyebrow">EVOLUTION CYCLE</span>
            <strong>{String(state.cycle).padStart(3, '0')}</strong>
            <span>
              {snapshot
                ? 'A memory of your world'
                : running
                  ? copy.simulation.running
                  : copy.simulation.paused}
            </span>
          </div>
        </div>
        <aside className="world-guide">
          <div className="stability-panel">
            <p className="eyebrow">
              <ShieldCheck size={13} />
              ECOLOGICAL STABILITY
            </p>
            <div className="stability-number">
              {Math.round(state.stability)}
              <span>/ 100</span>
            </div>
            <div className="stability-meter">
              <span style={{ width: `${state.stability}%` }} />
            </div>
            <p>
              {state.stability >= 70
                ? 'A delicate equilibrium. Give life room to grow.'
                : state.stability >= 40
                  ? 'Your world is finding its balance. Small changes can help.'
                  : 'Life is under pressure. Restore water, regulate heat, and protect what remains.'}
            </p>
          </div>
          <div className="current-event" key={latest?.id}>
            <span className="eyebrow">
              <Sparkles size={13} />
              {snapshot ? 'THIS MOMENT' : 'LATEST MOMENT'}
            </span>
            <h3>{latest?.title ?? 'Genesis'}</h3>
            <p>{latest?.description}</p>
            <span className="event-impact">{latest?.impact}</span>
            <button
              className="chronicle-link"
              onClick={() =>
                document.getElementById('world-chronicle')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              View chronicle
              <ChevronRight size={14} />
            </button>
          </div>
          <button className="discovery-peek" onClick={onDiscoveries}>
            <span>
              <Sparkles size={17} />
              {world.achievements.length} / {ACHIEVEMENTS.length} discoveries
            </span>
            <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
      <div className="evolution-bar">
        <div className="evolution-state">
          <span className={`status-dot ${running ? 'pulsing' : 'paused'}`} />
          <span className="evolution-description">
            {snapshot
              ? 'Viewing a memory'
              : running
                ? 'Evolution in progress'
                : 'A moment of stillness'}
          </span>
          <span className="evolution-cycle-mobile">CYCLE {String(state.cycle).padStart(3, '0')}</span>
        </div>
        <div className="time-controls">
          <button
            className="icon-button play-button"
            aria-label={running ? 'Pause evolution' : 'Resume evolution'}
            disabled={!!snapshot}
            onClick={() => setRunning(!running)}
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label="Advance one cycle"
            disabled={!!snapshot}
            onClick={() => {
              setRunning(false)
              onTick()
            }}
          >
            <SkipForward size={17} />
          </button>
          <span className="control-divider" />
          {[1, 2, 4].map((value) => (
            <button
              key={value}
              className={`speed-button ${speed === value ? 'active' : ''}`}
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
              aria-label={`Evolution speed ${value}x`}
            >
              {value}×
            </button>
          ))}
        </div>
        <span className="clock-note">
          1 cycle / {(2.4 / speed).toFixed(1)}s · Pauses when you leave
        </span>
      </div>
      {!snapshot && <NextChapter world={world} onDiscoveries={onDiscoveries} />}
      <section className="interventions" aria-labelledby="interventions-title">
        <div className="intervention-heading">
          <div>
            <p className="eyebrow">ONE SMALL CHANGE</p>
            <h2 id="interventions-title">Guide the next chapter.</h2>
          </div>
          <div className="energy-budget">
            <Zap size={19} />
            <strong>{Math.floor(world.state.energy)}</strong>
            <span>
              GENESIS ENERGY<small>Regenerates every cycle</small>
            </span>
          </div>
        </div>
        <p className="intervention-help">{guidance.text}</p>
        <div className="action-grid">
          {ACTIONS.map((action) => {
            const Icon = actionIcons[action.id]
            return (
              <button
                key={action.id}
                className={`action-card ${guidance.action === action.id ? 'is-suggested' : ''}`}
                disabled={world.state.energy < action.cost || !!snapshot}
                onClick={() => {
                  const error = onAct(action.id)
                  setFeedback(error ?? `${action.name} — ${action.effect}`)
                }}
                aria-label={`${action.name}, ${action.cost} Genesis Energy. ${action.description}`}
              >
                <div className="action-top">
                  <Icon size={22} />
                  <span>
                    <Zap size={12} />
                    {action.cost}
                  </span>
                </div>
                <h3>{action.name}</h3>
                <p>{action.description}</p>
                <span className="action-effect">{action.effect}</span>
              </button>
            )
          })}
        </div>
        <div className="action-feedback" role="status">
          {feedback}
        </div>
      </section>
      <div id="world-chronicle">
        <Chronicle world={world} selected={snapshot} onSelect={selectSnapshot} />
      </div>
      {newAchievement && (
        <div className="achievement-toast" role="status">
          <Sparkles size={24} />
          <div>
            <span className="eyebrow">DISCOVERY UNLOCKED</span>
            <strong>{newAchievement}</strong>
          </div>
        </div>
      )}
    </main>
  )
}
