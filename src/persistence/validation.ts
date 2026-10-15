import type { WorldInput, WorldRecord, WorldState } from '../types/world'

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_WORLDS = 100
export const MAX_CHRONICLE_ENTRIES = 500

const parameterKeys = ['water', 'temperature', 'solar', 'gravity', 'lifePotential']
const stateKeys = [...parameterKeys, 'cycle', 'humidity', 'vegetation', 'biodiversity', 'animals', 'fertility', 'resources', 'technology', 'civilization', 'pollution', 'stability', 'energy', 'rngState', 'balancedCycles', 'oceanCycles', 'wasInCrisis', 'recovered', 'volcanicActivity']
const percentKeys = ['humidity', 'vegetation', 'biodiversity', 'animals', 'fertility', 'resources', 'technology', 'civilization', 'pollution', 'stability', 'energy', 'volcanicActivity']

function invalid(path: string, message: string): never {
  throw new Error(`Invalid world data: ${path} ${message}.`)
}

export function object(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'must be an object')
  const result = value as Record<string, unknown>
  if (Object.keys(result).some(key => !keys.includes(key))) invalid(path, 'contains unsupported fields')
  for (const key of keys) if (!Object.hasOwn(result, key)) invalid(`${path}.${key}`, 'is missing')
  return result
}

function text(value: unknown, path: string, max: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(path, `must contain 1–${max} characters`)
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0
    if (point < 32 && ![9, 10, 13].includes(point)) invalid(path, 'contains control characters')
    if (point >= 0xd800 && point <= 0xdfff) invalid(path, 'contains malformed Unicode')
  }
}

function number(value: unknown, path: string, min: number, max: number, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    invalid(path, `must be ${integer ? 'an integer ' : ''}between ${min} and ${max}`)
  }
}

function parameters(value: Record<string, unknown>, path: string) {
  number(value.water, `${path}.water`, 0, 100)
  number(value.temperature, `${path}.temperature`, -50, 80)
  number(value.solar, `${path}.solar`, 20, 160)
  number(value.gravity, `${path}.gravity`, 0.3, 2)
  number(value.lifePotential, `${path}.lifePotential`, 0, 100)
}

function state(value: unknown, path: string): WorldState {
  const result = object(value, path, stateKeys)
  parameters(result, path)
  for (const key of percentKeys) number(result[key], `${path}.${key}`, 0, 100)
  number(result.cycle, `${path}.cycle`, 0, 1e9, true)
  number(result.rngState, `${path}.rngState`, 0, 0xffffffff, true)
  number(result.balancedCycles, `${path}.balancedCycles`, 0, result.cycle, true)
  number(result.oceanCycles, `${path}.oceanCycles`, 0, result.cycle, true)
  for (const key of ['wasInCrisis', 'recovered']) if (typeof result[key] !== 'boolean') invalid(`${path}.${key}`, 'must be a boolean')
  return result as unknown as WorldState
}

export function validateInput(value: unknown): WorldInput {
  const result = object(value, 'initial world', ['name', 'seed', ...parameterKeys])
  text(result.name, 'name', 40)
  text(result.seed, 'seed', 64)
  parameters(result, 'initial world')
  return structuredClone(result) as unknown as WorldInput
}

/** Validate every persisted field, including historical snapshots, before trusting it. */
export function validateWorld(value: unknown): WorldRecord {
  const result = object(value, 'world', ['schemaVersion', 'id', 'name', 'seed', 'createdAt', 'updatedAt', 'initial', 'state', 'chronicle', 'achievements'])
  if (result.schemaVersion !== 1) invalid('schemaVersion', 'is not supported; expected version 1')
  text(result.id, 'id', 128)
  text(result.name, 'name', 40)
  text(result.seed, 'seed', 64)
  number(result.createdAt, 'createdAt', 0, 8.64e15, true)
  number(result.updatedAt, 'updatedAt', result.createdAt, 8.64e15, true)
  parameters(object(result.initial, 'initial', parameterKeys), 'initial')
  const current = state(result.state, 'state')
  if (!Array.isArray(result.chronicle) || result.chronicle.length > MAX_CHRONICLE_ENTRIES) invalid('chronicle', `must have at most ${MAX_CHRONICLE_ENTRIES} entries`)
  const entryIds = new Set<string>()
  for (const [index, entry] of result.chronicle.entries()) {
    const path = `chronicle[${index}]`
    const item = object(entry, path, ['id', 'eventId', 'cycle', 'title', 'description', 'impact', 'tone', 'snapshot'])
    text(item.id, `${path}.id`, 256)
    if (entryIds.has(item.id)) invalid(`${path}.id`, 'is duplicated')
    entryIds.add(item.id)
    text(item.eventId, `${path}.eventId`, 64)
    text(item.title, `${path}.title`, 120)
    text(item.description, `${path}.description`, 1000)
    text(item.impact, `${path}.impact`, 500)
    number(item.cycle, `${path}.cycle`, 0, current.cycle, true)
    if (!['neutral', 'positive', 'warning'].includes(item.tone as string)) invalid(`${path}.tone`, 'is unsupported')
    if (state(item.snapshot, `${path}.snapshot`).cycle !== item.cycle) invalid(`${path}.snapshot.cycle`, 'does not match its event')
  }
  if (!Array.isArray(result.achievements) || result.achievements.length > 64) invalid('achievements', 'must have at most 64 items')
  for (const achievement of result.achievements) text(achievement, 'achievement', 64)
  if (new Set(result.achievements).size !== result.achievements.length) invalid('achievements', 'contains duplicate IDs')
  return structuredClone(result) as unknown as WorldRecord
}

export function validateCollection(value: unknown): WorldRecord[] {
  if (!Array.isArray(value) || value.length > MAX_WORLDS) invalid('worlds', `must be an array of at most ${MAX_WORLDS} worlds`)
  const result = value.map(validateWorld)
  if (new Set(result.map(world => world.id)).size !== result.length) invalid('worlds', 'contains duplicate IDs')
  return result
}
