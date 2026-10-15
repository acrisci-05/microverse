import { describe, expect, it } from 'vitest'
import { ACTIONS, ACHIEVEMENTS } from '../data/ecology'
import { applyAction, createWorld, DEFAULT_PARAMETERS, tickWorld, worldStatus } from '../engine'
import { ecologicalStability } from '../engine/ecology'
import { runEvents, WORLD_EVENTS } from '../engine/events'
import { PARAMETER_LIMITS, randomStep } from '../engine/math'
import { updateProgression } from '../engine/progression'
import type { ActionId, WorldParameters, WorldRecord, WorldState } from '../types/world'

const makeWorld = (parameters: Partial<WorldParameters> = {}, seed = 'test-orbit') =>
  createWorld({ ...DEFAULT_PARAMETERS, ...parameters, name: 'Test world', seed }, 'test-world', 1_000)

function advance(world: WorldRecord, cycles: number): WorldRecord {
  let next = world
  for (let i = 0; i < cycles; i++) next = tickWorld(next)
  return next
}

function freezeDeep<T extends object>(value: T): T {
  Object.freeze(value)
  for (const item of Object.values(value)) if (item && typeof item === 'object' && !Object.isFrozen(item)) freezeDeep(item)
  return value
}

function fundedAction(world: WorldRecord, action: ActionId): WorldRecord {
  let charged = world
  const cost = ACTIONS.find(item => item.id === action)!.cost
  while (charged.state.energy < cost) charged = tickWorld(charged)
  const result = applyAction(charged, action)
  expect(result.error).toBeUndefined()
  return result.world
}

describe('world generation and time', () => {
  it('reproduces the same seed and conditions through a long simulation', () => {
    const a = advance(makeWorld(), 500)
    const b = advance(makeWorld(), 500)
    expect(a).toEqual(b)
    expect(makeWorld({}, 'another-star').state).not.toEqual(makeWorld().state)
    expect(createWorld({ ...DEFAULT_PARAMETERS, name: 'Different name', seed: 'test-orbit' }, 'other-id', 2_000).state).toEqual(makeWorld().state)
  })

  it('resumes the serialized RNG and world exactly', () => {
    const world = advance(makeWorld(), 21)
    const roundTrip = JSON.parse(JSON.stringify(world)) as WorldRecord
    expect(advance(roundTrip, 60)).toEqual(advance(world, 60))
  })

  it('advances exactly one cycle per tick without changing wall-clock metadata', () => {
    const next = tickWorld(makeWorld())
    expect(next.state.cycle).toBe(1)
    expect(next.updatedAt).toBe(1_000)
    expect(next.createdAt).toBe(1_000)
  })

  it('does not mutate the world or any historical snapshots', () => {
    const world = freezeDeep(makeWorld())
    const before = JSON.stringify(world)
    expect(() => advance(world, 80)).not.toThrow()
    expect(() => applyAction(world, 'forest')).not.toThrow()
    expect(JSON.stringify(world)).toBe(before)
  })

  it('normalizes invalid initial values and provides fallback names', () => {
    const world = createWorld({ name: ' ', seed: ' ', water: Infinity, temperature: -100,
      solar: 999, gravity: 0, lifePotential: NaN }, 'id', 100)
    expect(world.initial).toEqual({ water: 0, temperature: -50, solar: 160, gravity: 0.3, lifePotential: 0 })
    expect(world.name).toBe('Unnamed world')
    expect(world.seed).toBe('tiny-world')
  })
})

describe('ecological relationships', () => {
  it.each([
    ['dry', { water: 0 }], ['flooded', { water: 100 }], ['freezing', { temperature: -50 }],
    ['scorched', { temperature: 80 }], ['dim', { solar: 20 }], ['bright', { solar: 160 }],
    ['heavy', { gravity: 2 }], ['lifeless', { lifePotential: 0 }],
  ] as [string, Partial<WorldParameters>][] )('%s initial conditions have consequences for living cover', (_label, parameters) => {
    expect(advance(makeWorld(parameters), 35).state.vegetation).toBeLessThan(advance(makeWorld(), 35).state.vegetation)
  })

  it('allows a genuinely lifeless planet until species are introduced', () => {
    const barren = advance(makeWorld({ lifePotential: 0 }), 50)
    expect(barren.state.vegetation).toBe(0)
    expect(barren.state.biodiversity).toBe(0)
    expect(barren.state.animals).toBe(0)
    const seeded = advance(fundedAction(barren, 'species'), 30)
    expect(seeded.state.vegetation).toBeGreaterThan(0)
    expect(seeded.state.animals).toBeGreaterThan(0)
  })

  it('keeps every numeric field finite and within documented bounds over extreme long runs', () => {
    const extremes: Partial<WorldParameters>[] = [
      { water: 0, temperature: 80, solar: 160, gravity: 2, lifePotential: 0 },
      { water: 100, temperature: -50, solar: 20, gravity: 0.3, lifePotential: 100 },
      { water: 100, temperature: 80, solar: 160, gravity: 2, lifePotential: 100 },
      { water: 0, temperature: -50, solar: 20, gravity: 0.3, lifePotential: 0 },
      DEFAULT_PARAMETERS,
    ]
    for (const parameters of extremes) {
      const world = advance(makeWorld(parameters), 1_200)
      for (const [key, value] of Object.entries(world.state)) {
        if (typeof value !== 'number') continue
        expect(Number.isFinite(value), key).toBe(true)
        if (key === 'rngState') { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(0xffffffff); continue }
        if (key === 'cycle' || key.endsWith('Cycles')) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1_200); continue }
        const range = PARAMETER_LIMITS[key as keyof WorldParameters] ?? [0, 100]
        expect(value, key).toBeGreaterThanOrEqual(range[0])
        expect(value, key).toBeLessThanOrEqual(range[1])
      }
      for (const entry of world.chronicle) expect(entry.snapshot.cycle).toBe(entry.cycle)
    }
  })

  it('settlements consume finite resources and raise pollution', () => {
    const healthy = advance(makeWorld({ lifePotential: 100 }), 60)
    const settled = fundedAction(healthy, 'settlement')
    expect(settled.state.resources).toBeCloseTo(healthy.state.resources - 12)
    expect(settled.state.pollution).toBeCloseTo(healthy.state.pollution + 6)
    expect(settled.state.civilization).toBeGreaterThan(healthy.state.civilization)
    expect(settled.state.technology).toBeGreaterThan(healthy.state.technology)
  })

  it('makes industry consequential while allowing paid conservation to preserve the world', () => {
    const neglected = advance(makeWorld({ lifePotential: 100 }, 'solstice'), 600)
    expect(neglected.state.wasInCrisis).toBe(true)
    expect(neglected.state.pollution).toBeGreaterThan(74)
    expect(neglected.achievements).not.toContain('against-the-odds')

    let protectedWorld = makeWorld({ lifePotential: 100 }, 'solstice')
    for (let i = 0; i < 600; i++) {
      protectedWorld = tickWorld(protectedWorld)
      if (protectedWorld.state.pollution >= 12 && protectedWorld.state.energy >= 26) {
        protectedWorld = applyAction(protectedWorld, 'protect').world
      }
    }
    expect(protectedWorld.state.stability).toBeGreaterThan(80)
    expect(protectedWorld.state.civilization).toBeGreaterThan(30)
    expect(protectedWorld.state.pollution).toBeLessThan(12)
  })
})

describe('interventions and recovery', () => {
  it.each(ACTIONS)('$name cannot spend energy that is not available', action => {
    const world = makeWorld()
    world.state.energy = 0
    const result = applyAction(world, action.id)
    expect(result.error).toContain('Genesis energy')
    expect(result.world).toBe(world)
  })

  it('charges the displayed cost and records the actual changed state', () => {
    const world = makeWorld()
    const result = applyAction(world, 'forest')
    expect(result.error).toBeUndefined()
    expect(result.world.state.energy).toBe(world.state.energy - 18)
    expect(result.world.state.vegetation).toBe(world.state.vegetation + 18)
    expect(result.world.state.water).toBe(world.state.water - 2)
    expect(result.world.chronicle.at(-1)?.snapshot).toEqual(result.world.state)
    expect(world.chronicle).toHaveLength(1)
  })

  it('does not charge for impossible settlements', () => {
    const world = makeWorld({ water: 0, temperature: 80 })
    const result = applyAction(world, 'settlement')
    expect(result.error).toContain('Settlements need')
    expect(result.world).toBe(world)
    expect(world.state.energy).toBe(80)
  })

  it('regenerates energy even during a total ecological collapse', () => {
    const world = makeWorld({ water: 0, temperature: 80, lifePotential: 0 })
    world.state.energy = 0
    const recharged = advance(world, 8)
    expect(recharged.state.energy).toBeGreaterThanOrEqual(28.8)
    expect(worldStatus(world.state)).toBe('In crisis')
  })

  it.each([
    { water: 0, temperature: 80, solar: 160 },
    { water: 100, temperature: -50, solar: 20 },
  ])('recovers an extreme starting planet through real paid actions: %o', parameters => {
    let world = makeWorld({ ...parameters, lifePotential: 0 })
    world = tickWorld(world)
    for (let i = 0; i < 4; i++) world = fundedAction(world, 'heat')
    for (let i = 0; i < 3; i++) world = fundedAction(world, 'ocean')
    for (let i = 0; i < 6; i++) world = fundedAction(world, 'species')
    for (let i = 0; i < 4; i++) world = fundedAction(world, 'forest')
    world = advance(world, 100)
    expect(world.achievements).toContain('against-the-odds')
    expect(world.achievements).toContain('second-chance')
    expect(world.state.recovered).toBe(true)
    expect(world.state.stability).toBeGreaterThan(68)
  })

  it('retains milestone snapshots while bounding a long action history', () => {
    let world = advance(makeWorld({ lifePotential: 100 }), 80)
    const milestones = world.chronicle.filter(entry => !entry.eventId.startsWith('action-'))
    for (let i = 0; i < 210; i++) world = fundedAction(world, 'protect')
    expect(world.chronicle.length).toBeLessThanOrEqual(180)
    for (const entry of milestones) expect(world.chronicle).toContainEqual(entry)
    expect(new Set(world.chronicle.map(entry => entry.id)).size).toBe(world.chronicle.length)
  })
})

describe('state-driven events', () => {
  const fixtures: Record<string, Partial<WorldState>> = {
    'ecological-crisis': { cycle: 1, stability: 20, temperature: 65 },
    'first-rainfall': { cycle: 2, humidity: 50, temperature: 18, water: 60 },
    'forest-awakening': { cycle: 4, vegetation: 50 },
    'ice-expansion': { cycle: 3, temperature: -10 },
    'volcanic-activity': { cycle: 8, resources: 50, gravity: 1 },
    'great-drought': { cycle: 3, water: 20 },
    'species-emergence': { cycle: 6, biodiversity: 35, vegetation: 40 },
    'biodiversity-bloom': { cycle: 10, biodiversity: 65, stability: 75 },
    'meteor-shower': { cycle: 18, resources: 50 },
    'coastal-settlement': { cycle: 16, civilization: 0, water: 60, temperature: 20, vegetation: 50, biodiversity: 50, stability: 75 },
  }

  it.each(WORLD_EVENTS)('$title has a real effect and an immutable after-event snapshot', event => {
    let rngState = 0
    while (randomStep(rngState).value >= 0.05) rngState++
    const world = makeWorld()
    world.state = { ...world.state, ...fixtures[event.id], rngState }
    world.chronicle = WORLD_EVENTS.filter(item => item.id !== event.id).map(item => ({
      ...world.chronicle[0], id: item.id, eventId: item.id,
    }))
    const before = structuredClone(world)
    const result = runEvents(freezeDeep(world))
    const entry = result.chronicle.find(item => item.eventId === event.id)
    expect(entry).toBeDefined()
    for (const [key, delta] of Object.entries(event.effects)) {
      const field = key as keyof WorldState
      const range = PARAMETER_LIMITS[key as keyof WorldParameters] ?? [0, 100]
      const expected = Math.min(range[1], Math.max(range[0], (before.state[field] as number) + (delta as number)))
      expect(result.state[field]).toBeCloseTo(expected)
    }
    expect(entry?.snapshot).toEqual(result.state)
    expect(world).toEqual(before)
    expect(runEvents(result).chronicle.filter(item => item.eventId === event.id)).toHaveLength(1)
  })

  it('does not emit milestones before their conditions are true', () => {
    expect(runEvents(makeWorld()).chronicle).toHaveLength(1)
  })

  it('naturally records the climate and life milestones during play', () => {
    const fertile = advance(makeWorld({ lifePotential: 100 }), 250)
    for (const id of ['first-rainfall', 'forest-awakening', 'species-emergence', 'biodiversity-bloom', 'coastal-settlement']) {
      expect(fertile.chronicle.some(entry => entry.eventId === id), id).toBe(true)
    }
    expect(advance(makeWorld({ temperature: -35 }), 4).chronicle.some(entry => entry.eventId === 'ice-expansion')).toBe(true)
    expect(advance(makeWorld({ water: 15 }), 4).chronicle.some(entry => entry.eventId === 'great-drought')).toBe(true)
  })
})

describe('verifiable discoveries', () => {
  it('makes all four non-crisis discoveries reachable by normal evolution', () => {
    const world = advance(makeWorld({ lifePotential: 100 }), 300)
    for (const id of ['green-genesis', 'ocean-keeper', 'first-civilization', 'perfect-balance']) {
      expect(world.achievements, id).toContain(id)
    }
    expect(ACHIEVEMENTS).toHaveLength(6)
  })

  it('requires elapsed consecutive cycles and never invents a streak through actions', () => {
    const world = makeWorld({ lifePotential: 100 })
    world.state = { ...world.state, cycle: 20, vegetation: 85, biodiversity: 85, fertility: 95, resources: 95, humidity: 65 }
    world.state.stability = ecologicalStability(world.state)
    const action = applyAction(world, 'protect').world
    expect(action.state.balancedCycles).toBe(0)
    expect(action.state.oceanCycles).toBe(0)
    expect(action.achievements).not.toContain('perfect-balance')
    expect(action.achievements).not.toContain('ocean-keeper')
    const almost = advance(action, 11)
    expect(almost.achievements).not.toContain('ocean-keeper')
    expect(tickWorld(almost).achievements).toContain('ocean-keeper')
  })

  it('resets a broken streak and grants achievements only once', () => {
    const world = makeWorld()
    world.state = { ...world.state, cycle: 25, balancedCycles: 15, oceanCycles: 11, stability: 50, water: 15 }
    const broken = updateProgression(world, true)
    expect(broken.state.balancedCycles).toBe(0)
    expect(broken.state.oceanCycles).toBe(0)
    const thriving = advance(makeWorld({ lifePotential: 100 }), 150)
    const again = updateProgression(thriving, false)
    expect(again.achievements).toEqual(thriving.achievements)
    expect(again.state.energy).toBe(thriving.state.energy)
    expect(again.chronicle).toEqual(thriving.chronicle)
  })

  it('never calls a world recovered while industrial pollution still constitutes a crisis', () => {
    const world = makeWorld()
    world.state = { ...world.state, cycle: 100, wasInCrisis: true, stability: 60,
      temperature: 22, vegetation: 85, biodiversity: 85, pollution: 80 }
    const ongoing = updateProgression(world, true)
    expect(ongoing.achievements).not.toContain('against-the-odds')
    expect(ongoing.achievements).not.toContain('second-chance')
    expect(ongoing.state.recovered).toBe(false)
  })
})
