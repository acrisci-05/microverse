import type { WorldState } from '../types/world'
import { boundState, clamp } from './math'

/** A stylized habitat score. Cold, heat, very dry/wet worlds, and gravity all matter. */
export function habitability(state: WorldState): number {
  const thermal = Math.exp(-Math.pow((state.temperature - 20) / 33, 2))
  const water = clamp(state.water / 42, 0, 1) * clamp((100 - state.water) / 24, 0.04, 1)
  const light = clamp(1 - Math.abs(state.solar - 100) / 120, 0.15, 1)
  const gravity = clamp(1 - Math.abs(state.gravity - 1) * 0.52, 0.35, 1)
  return thermal * water * light * gravity
}

export function ecologicalStability(state: WorldState): number {
  return clamp(habitability(state) * 32 + state.vegetation * 0.22 + state.biodiversity * 0.22
    + state.fertility * 0.13 + state.resources * 0.11 - state.pollution * 0.45)
}

export function isCrisis(state: WorldState): boolean {
  return state.stability < 32 || state.temperature > 49 || state.temperature < -20
    || state.water < 12 || state.pollution > 74
}

export function evolveEcology(previous: WorldState): WorldState {
  const state = { ...previous, cycle: previous.cycle + 1 }

  // Sunlight sets the long-term temperature. Forests cool; industry and lava warm.
  const equilibrium = 18 + (state.solar - 100) * 0.42 + state.pollution * 0.1
    + state.volcanicActivity * 0.035 - (state.vegetation - 40) * 0.035
  state.temperature += (equilibrium - state.temperature) * 0.018
  state.water -= Math.max(0, state.temperature - 32) * 0.002
  const humidityTarget = state.water * 0.76 + state.vegetation * 0.23
    + Math.max(0, state.temperature) * 0.17 - Math.max(0, state.temperature - 26) * 0.65
  state.humidity += (clamp(humidityTarget) - state.humidity) * 0.12

  const habitat = habitability(state)
  const life = state.lifePotential > 0 ? 0.45 + state.lifePotential * 0.0055 : 0
  const plantTarget = clamp(100 * habitat * (0.48 + state.fertility * 0.0052) * life - state.pollution * 0.22)
  state.vegetation += (plantTarget - state.vegetation) * 0.048

  const diversityTarget = state.lifePotential > 0 ? clamp((state.vegetation * 0.58 + state.animals * 0.25 + state.humidity * 0.17)
    * Math.sqrt(habitat) + state.lifePotential * 0.22 * habitat - state.pollution * 0.65) : 0
  state.biodiversity += (diversityTarget - state.biodiversity) * 0.045
  const animalTarget = clamp((state.vegetation * 0.65 + state.biodiversity * 0.35)
    * Math.sqrt(habitat) - state.pollution * 0.22)
  state.animals += (animalTarget - state.animals) * 0.055

  const fertilityTarget = clamp(40 + state.vegetation * 0.58 + state.biodiversity * 0.16
    - state.pollution * 0.65 - Math.max(0, state.temperature - 35) * 1.2)
  state.fertility += (fertilityTarget - state.fertility) * 0.026
  state.resources += state.fertility * 0.009 + state.vegetation * 0.008
    - state.civilization * 0.015 - state.technology * 0.003 - state.pollution * 0.002

  if (state.civilization > 0) {
    const carryingCapacity = clamp((state.resources * 0.52 + state.technology * 0.4
      + state.stability * 0.22) * habitat)
    state.civilization += (carryingCapacity - state.civilization) * 0.008
    const technologyTarget = clamp(state.biodiversity * 0.25 + state.resources * 0.5 + state.civilization * 0.28)
    state.technology += (technologyTarget - state.technology) * 0.018
  }
  state.pollution += state.civilization * 0.014 + state.technology * 0.007
    - state.vegetation * 0.01 - state.biodiversity * 0.0025 - 0.12
  state.volcanicActivity *= 0.88
  const bounded = boundState(state)
  bounded.stability = ecologicalStability(bounded)
  // Even a lifeless world receives enough energy to recover; no terminal failure.
  bounded.energy = clamp(bounded.energy + 3.6 + bounded.stability * 0.02)
  bounded.wasInCrisis ||= isCrisis(bounded)
  return bounded
}
