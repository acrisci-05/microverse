import { ACTIONS } from '../data/ecology'
import type { ActionId, ActionResult, WorldInput, WorldRecord, WorldState } from '../types/world'
import { ecologicalStability, evolveEcology, habitability, isCrisis } from './ecology'
import { appendChronicle, runEvents } from './events'
import { approach, boundState, clamp, hashSeed, normalizeParameters, randomStep } from './math'
import { updateProgression } from './progression'

export { DEFAULT_PARAMETERS, PARAMETER_LIMITS, hashSeed } from './math'

function cleanText(value: string, length: number): string {
  return value.trim().replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .slice(0, length).replace(/[\uD800-\uDBFF]$/, '')
}

export function createWorld(input: WorldInput, id?: string, now = Date.now()): WorldRecord {
  const initial = normalizeParameters(input)
  const seed = cleanText(input.seed, 64) || 'tiny-world'
  const random = randomStep(hashSeed(seed))
  const variation = (random.value - 0.5) * 8
  const state: WorldState = {
    ...initial, cycle: 0, humidity: clamp(initial.water * 0.75 + 7 + variation),
    vegetation: 0, biodiversity: 0, animals: 0,
    fertility: clamp(45 + initial.lifePotential * 0.3 - Math.abs(initial.temperature - 20) * 0.25 + variation),
    resources: clamp(71 + variation), technology: 0, civilization: 0, pollution: 0,
    stability: 0, energy: 80, rngState: random.state,
    balancedCycles: 0, oceanCycles: 0, wasInCrisis: false, recovered: false, volcanicActivity: 0,
  }
  const habitat = habitability(state)
  state.vegetation = clamp(initial.lifePotential * 0.53 * habitat)
  state.biodiversity = clamp(initial.lifePotential * 0.42 * habitat)
  state.animals = clamp(initial.lifePotential * 0.2 * habitat)
  state.stability = ecologicalStability(state)
  state.wasInCrisis = isCrisis(state)
  const worldId = id ?? `world-${hashSeed(seed).toString(36)}-${now.toString(36)}`
  return {
    schemaVersion: 1, id: worldId, name: cleanText(input.name, 40) || 'Unnamed world', seed,
    createdAt: now, updatedAt: now, initial, state, achievements: [],
    chronicle: [{
      id: `${worldId}:0:genesis`, eventId: 'genesis', cycle: 0, title: 'Genesis',
      description: 'A tiny planet takes its first breath. Every choice from here leaves a trace.',
      impact: 'Your world begins · 80 Genesis energy', tone: 'neutral', snapshot: { ...state },
    }],
  }
}

/** One discrete cycle. Caller owns scheduling and wall-clock save timestamps. */
export function tickWorld(world: WorldRecord): WorldRecord {
  if (world.state.cycle >= 1_000_000_000) return world
  const evolved = { ...world, state: evolveEcology(world.state) }
  return updateProgression(runEvents(evolved), true)
}

export function applyAction(world: WorldRecord, actionId: ActionId): ActionResult {
  const action = ACTIONS.find(item => item.id === actionId)
  if (!action) return { world, error: 'This intervention is not available.' }
  if (world.state.energy < action.cost) {
    return { world, error: `You need ${action.cost} Genesis energy. Let a few cycles pass to recharge.` }
  }
  if (actionId === 'settlement' && (world.state.vegetation < 35 || world.state.biodiversity < 25
    || world.state.water < 20 || world.state.water > 88 || world.state.temperature < -4
    || world.state.temperature > 45 || world.state.resources < 25)) {
    return { world, error: 'Settlements need 35% vegetation, 25% biodiversity, 25% resources, water between 20–88%, and a temperature between −4–45°C.' }
  }
  let state = { ...world.state, energy: world.state.energy - action.cost }
  switch (actionId) {
    case 'forest':
      state.vegetation += 18
      state.biodiversity += 4
      state.fertility += 4
      state.humidity += 4
      state.water -= 2
      break
    case 'ocean':
      state.water = approach(state.water, 64, 22)
      state.fertility += 8
      state.humidity += 6
      break
    case 'heat':
      state.temperature = approach(state.temperature, 18, 22)
      state.solar = approach(state.solar, 100, 25)
      break
    case 'species':
      state.biodiversity += 14
      state.animals += 8
      state.lifePotential += 16
      break
    case 'protect':
      state.pollution -= 20
      state.biodiversity += 10
      state.fertility += 8
      state.resources += 5
      break
    case 'settlement':
      state.civilization += 18
      state.technology += 6
      state.resources -= 12
      state.pollution += 6
      break
  }
  state = boundState(state)
  state.stability = ecologicalStability(state)
  state.wasInCrisis ||= isCrisis(state)
  const sameCycleActions = world.chronicle.filter(entry => entry.cycle === state.cycle && entry.eventId.startsWith('action-')).length
  const chronicle = appendChronicle(world.chronicle, {
    id: `${world.id}:${state.cycle}:action-${actionId}-${sameCycleActions}`,
    eventId: `action-${actionId}`, cycle: state.cycle, title: action.name,
    description: action.description, impact: `${action.effect} · −${action.cost} Genesis energy`,
    tone: 'neutral', snapshot: { ...state },
  })
  return { world: updateProgression({ ...world, state, chronicle }, false) }
}

export function worldStatus(state: WorldState): string {
  if (isCrisis(state)) return 'In crisis'
  if (state.stability >= 80) return 'Thriving'
  if (state.stability >= 60) return 'Balanced'
  if (state.temperature <= -6) return 'Frozen'
  if (state.water < 28 || state.temperature > 39) return 'Arid'
  return 'Evolving'
}
