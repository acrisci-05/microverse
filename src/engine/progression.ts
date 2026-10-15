import { ACHIEVEMENTS } from '../data/ecology'
import type { WorldRecord } from '../types/world'
import { isCrisis } from './ecology'
import { appendChronicle } from './events'
import { clamp } from './math'

export function updateProgression(world: WorldRecord, countCycle: boolean): WorldRecord {
  const state = { ...world.state }
  const oceanHealthy = state.water >= 50 && state.water <= 80 && state.humidity >= 45 && state.stability >= 65
  if (countCycle) {
    state.balancedCycles = state.stability >= 80 ? state.balancedCycles + 1 : 0
    state.oceanCycles = oceanHealthy ? state.oceanCycles + 1 : 0
  } else {
    // Actions may break a streak, but never fabricate elapsed cycles.
    if (state.stability < 80) state.balancedCycles = 0
    if (!oceanHealthy) state.oceanCycles = 0
  }
  const outOfCrisis = !isCrisis(state) && state.temperature >= -5 && state.temperature <= 40
  const recovered = state.wasInCrisis && state.stability >= 68 && state.vegetation >= 45 && state.biodiversity >= 45 && outOfCrisis
  state.recovered ||= recovered
  const conditions: Record<string, boolean> = {
    'green-genesis': state.vegetation >= 70,
    'ocean-keeper': state.oceanCycles >= 12,
    'against-the-odds': state.wasInCrisis && state.stability >= 45 && state.biodiversity >= 20 && outOfCrisis,
    'first-civilization': state.civilization >= 12,
    'perfect-balance': state.balancedCycles >= 16,
    'second-chance': recovered,
  }
  const achievements = [...world.achievements]
  let chronicle = world.chronicle
  for (const achievement of ACHIEVEMENTS) {
    if (!conditions[achievement.id] || achievements.includes(achievement.id)) continue
    achievements.push(achievement.id)
    state.energy = clamp(state.energy + 8)
    chronicle = appendChronicle(chronicle, {
      id: `${world.id}:${state.cycle}:achievement-${achievement.id}`,
      eventId: `achievement-${achievement.id}`, cycle: state.cycle,
      title: achievement.name, description: achievement.description,
      impact: 'Discovery unlocked · +8 Genesis energy', tone: 'positive', snapshot: { ...state },
    })
  }
  return { ...world, state, achievements, chronicle }
}
