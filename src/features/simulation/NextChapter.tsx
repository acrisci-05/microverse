import { ArrowUpRight, Sparkles } from 'lucide-react'
import { ACHIEVEMENTS } from '../../data/ecology'
import { achievementIcons } from '../../data/iconMaps'
import type { WorldRecord } from '../../types/world'

export function NextChapter({
  world,
  onDiscoveries,
}: {
  world: WorldRecord
  onDiscoveries: () => void
}) {
  const { state } = world
  const available = ACHIEVEMENTS.filter((a) => !world.achievements.includes(a.id))
  const next = available.find(
    (a) => state.wasInCrisis || !['against-the-odds', 'second-chance'].includes(a.id),
  )
  if (!next)
    return (
      <button className="next-chapter" onClick={onDiscoveries}>
        <Sparkles size={23} />
        <div>
          <span className="eyebrow">A WORLD WORTH KEEPING</span>
          <strong>
            {available.length
              ? 'Every balance is worth protecting.'
              : 'Every discovery. One remarkable world.'}
          </strong>
          <p>Keep watching. Your world is still writing its story.</p>
        </div>
        <ArrowUpRight size={18} />
      </button>
    )
  const progress =
    next.id === 'green-genesis'
      ? `${Math.round(state.vegetation)} / 70% vegetation`
      : next.id === 'ocean-keeper'
        ? `${Math.min(state.oceanCycles, 12)} / 12 balanced ocean cycles`
        : next.id === 'perfect-balance'
          ? `${Math.min(state.balancedCycles, 16)} / 16 stable cycles`
          : next.id === 'first-civilization'
            ? `${Math.round(state.civilization)} / 12% civilization`
            : `${Math.round(state.stability)}% stability · recovery in progress`
  const Icon = achievementIcons[next.icon]
  return (
    <button className="next-chapter" onClick={onDiscoveries}>
      <Icon size={25} />
      <div>
        <span className="eyebrow">YOUR NEXT DISCOVERY</span>
        <strong>{next.name}</strong>
        <p>{next.description}</p>
      </div>
      <span className="next-progress">
        {progress}
        <ArrowUpRight size={15} />
      </span>
    </button>
  )
}
