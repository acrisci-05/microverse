import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorldInput, WorldRecord, WorldState } from '../types/world'
import { applyAction, createWorld, tickWorld } from '../engine'
import { DATABASE_NAME, decodeWorld, deleteWorld, duplicateWorld, encodeWorld, exportWorlds, importWorlds, loadWorlds, saveWorld } from '../persistence'

const initial = { water: 62, temperature: 18, solar: 100, gravity: 1, lifePotential: 58 }
const input: WorldInput = { ...initial, name: 'Terra — 地球 🌍', seed: 'caffè/星/🌌' }

function world(id = 'world-1'): WorldRecord {
  const state: WorldState = {
    ...initial, cycle: 3, humidity: 50, vegetation: 30, biodiversity: 20,
    animals: 15, fertility: 55, resources: 70, technology: 0, civilization: 0,
    pollution: 0, stability: 65, energy: 85, rngState: 4294967295,
    balancedCycles: 2, oceanCycles: 1, wasInCrisis: false, recovered: false, volcanicActivity: 0,
  }
  return {
    schemaVersion: 1, id, name: input.name, seed: input.seed,
    createdAt: 1000, updatedAt: 2000, initial: { ...initial }, state,
    chronicle: [{ id: 'entry-1', eventId: 'genesis', cycle: 0, title: 'Genesis', description: 'A tiny planet is born.', impact: 'A new beginning.', tone: 'neutral', snapshot: { ...state, cycle: 0, balancedCycles: 0, oceanCycles: 0 } }],
    achievements: ['green-genesis'],
  }
}

beforeEach(async () => {
  // Opening at the same version allows tests to inspect actual persisted records.
  await loadWorlds()
  const db = await openDB(DATABASE_NAME, 1)
  await db.clear('worlds')
  db.close()
})

describe('durable universe storage', () => {
  it('persists separate worlds across a fresh module load and supports deletion', async () => {
    const first = world()
    const second = { ...world('world-2'), updatedAt: 3000 }
    await saveWorld(first)
    await saveWorld(second)
    vi.resetModules()
    const reloaded = await import('../persistence')
    const saved = await reloaded.loadWorlds()
    expect(saved.warnings).toEqual([])
    expect(saved.worlds).toEqual([second, first])
    await deleteWorld(second.id)
    expect((await loadWorlds()).worlds).toEqual([first])
  })

  it('stores a deep snapshot independent from subsequent in-memory edits', async () => {
    const original = world()
    await saveWorld(original)
    original.state.water = 1
    original.chronicle[0].snapshot.vegetation = 0
    const [saved] = (await loadWorlds()).worlds
    expect(saved.state.water).toBe(62)
    expect(saved.chronicle[0].snapshot.vegetation).toBe(30)
  })

  it('isolates corrupt records, reports them, and preserves original bytes for recovery', async () => {
    await saveWorld(world())
    const db = await openDB(DATABASE_NAME, 1)
    await db.put('worlds', { ...world('broken-world'), state: { water: 'corrupted' } })
    const result = await loadWorlds()
    expect(result.worlds.map(item => item.id)).toEqual(['world-1'])
    expect(result.warnings).toHaveLength(1)
    expect(await db.count('worlds')).toBe(2)
    db.close()
  })

  it('rejects invalid updates without replacing the last valid save', async () => {
    const valid = world()
    await saveWorld(valid)
    await expect(saveWorld({ ...valid, state: { ...valid.state, energy: Number.NaN } })).rejects.toThrow('energy')
    expect((await loadWorlds()).worlds).toEqual([valid])
  })

  it('reports write failures, retains the previous record, and can save after storage recovers', async () => {
    const valid = world()
    await saveWorld(valid)
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw new DOMException('Quota reached', 'QuotaExceededError')
    })
    try {
      await expect(saveWorld({ ...valid, name: 'Unsaved name' })).rejects.toThrow('could not be saved')
    } finally { transaction.mockRestore() }
    expect((await loadWorlds()).worlds).toEqual([valid])
    await saveWorld({ ...valid, name: 'Recovered save' })
    expect((await loadWorlds()).worlds[0].name).toBe('Recovered save')
  })

  it('reports unavailable IndexedDB instead of silently substituting another storage mechanism', async () => {
    vi.resetModules()
    const unavailableStorage = await import('../persistence')
    vi.stubGlobal('indexedDB', undefined)
    try {
      await expect(unavailableStorage.loadWorlds()).rejects.toThrow('Local storage is unavailable')
    } finally { vi.unstubAllGlobals() }
    // An unsuccessful open must not permanently poison the connection promise.
    expect(await unavailableStorage.loadWorlds()).toEqual({ worlds: [], warnings: [] })
  })

  it('resumes an evolved engine world with identical future RNG, events, and achievements', async () => {
    let running = createWorld(input, 'engine-world', 1000)
    for (let cycle = 0; cycle < 45; cycle++) {
      running = tickWorld(running)
      if (cycle % 9 === 0) running = applyAction(running, 'forest').world
    }
    await saveWorld(running)
    let resumed = (await loadWorlds()).worlds[0]
    for (let cycle = 0; cycle < 45; cycle++) {
      running = tickWorld(running)
      resumed = tickWorld(resumed)
    }
    expect(resumed).toEqual(running)
    expect(importWorlds(exportWorlds([resumed]))[0]).toEqual(running)
  })
})

describe('versioned backups', () => {
  it('round-trips complete progress, achievements, and chronicle snapshots', () => {
    const original = [world(), world('world-2')]
    expect(importWorlds(exportWorlds(original))).toEqual(original)
  })

  it('does not mutate or share references with exported input', () => {
    const original = world()
    const imported = importWorlds(exportWorlds([original]))
    imported[0].chronicle[0].snapshot.vegetation = 98
    expect(original.chronicle[0].snapshot.vegetation).toBe(30)
  })

  it.each(['{broken', '{}', '[]', 'null', '{"format":"other","version":1,"worlds":[]}'])('rejects malformed or foreign envelope %s', json => {
    expect(() => importWorlds(json)).toThrow()
  })

  it('rejects unsupported versions, duplicate IDs, and partial records', () => {
    const envelope = JSON.parse(exportWorlds([world()]))
    expect(() => importWorlds(JSON.stringify({ ...envelope, version: 2 }))).toThrow('version')
    expect(() => importWorlds(JSON.stringify({ ...envelope, worlds: [world(), world()] }))).toThrow('duplicate')
    expect(() => importWorlds(JSON.stringify({ ...envelope, worlds: [{ id: 'world-1' }] }))).toThrow('missing')
  })

  it.each([
    ['temperature', -51], ['water', 101], ['gravity', 0], ['solar', 161],
    ['cycle', 1.5], ['rngState', -1], ['balancedCycles', 4], ['energy', '100'],
  ])('rejects out-of-range or non-numeric state %s', (key, value) => {
    const changed = world()
    Object.assign(changed.state, { [key]: value })
    expect(() => exportWorlds([changed])).toThrow()
  })

  it('validates historical snapshots and their cycle association', () => {
    const changed = world()
    changed.chronicle[0].snapshot.cycle = 2
    expect(() => exportWorlds([changed])).toThrow('does not match')
    changed.chronicle[0].snapshot.cycle = 0
    changed.chronicle[0].snapshot.water = -1
    expect(() => exportWorlds([changed])).toThrow('water')
  })

  it('rejects unknown fields and prototype injection', () => {
    const json = exportWorlds([world()]).replace('"format": "microverse",', '"format": "microverse", "__proto__": {"polluted": true},')
    expect(() => importWorlds(json)).toThrow('unsupported fields')
    expect(Object.hasOwn({}, 'polluted')).toBe(false)
  })

  it('enforces name, seed, collection, and file limits', () => {
    expect(() => exportWorlds([{ ...world(), name: 'x'.repeat(41) }])).toThrow('name')
    expect(() => exportWorlds([{ ...world(), seed: 'x'.repeat(65) }])).toThrow('seed')
    expect(() => exportWorlds(Array.from({ length: 101 }, (_, i) => world(`world-${i}`)))).toThrow('at most 100')
    expect(() => importWorlds(' '.repeat(10 * 1024 * 1024 + 1))).toThrow('10 MB')
  })
})

describe('genesis share codes', () => {
  it('round-trips non-Latin names and Unicode seeds without losing code points', () => {
    const code = encodeWorld(input)
    expect(code).toMatch(/^MX1\.[A-Za-z0-9_-]+$/)
    expect(decodeWorld(`  ${code}  `)).toEqual(input)
  })

  it.each(['', 'MX2.abc', 'MX1.!!!', 'MX1.abc'])('rejects malformed code %s', code => {
    expect(() => decodeWorld(code)).toThrow()
  })

  it('rejects oversized share payloads before decoding', () => {
    expect(() => decodeWorld('MX1.' + 'a'.repeat(4096))).toThrow('4096')
  })

  it('validates decoded conditions, not just the prefix', () => {
    const payload = btoa(JSON.stringify({ version: 1, initial: { ...input, name: 'Terra', seed: 'seed', water: 999 } })).replace(/=+$/, '')
    expect(() => decodeWorld(`MX1.${payload}`)).toThrow('damaged')
    expect(() => encodeWorld({ ...input, name: '\ud800' })).toThrow('Unicode')
  })
})

describe('world duplication', () => {
  it('preserves progression and historical snapshots without sharing mutable state', () => {
    const original = world()
    const copy = duplicateWorld(original, 'copy-id', 5000)
    expect(copy.id).toBe('copy-id')
    expect(copy.name).toBe(`${original.name} · copy`)
    expect(copy.createdAt).toBe(5000)
    expect(copy.updatedAt).toBe(5000)
    expect(copy.state).toEqual(original.state)
    expect(copy.chronicle).toEqual(original.chronicle)
    copy.state.energy = 0
    copy.chronicle[0].snapshot.water = 0
    copy.achievements.push('another-achievement')
    expect(original.state.energy).toBe(85)
    expect(original.chronicle[0].snapshot.water).toBe(62)
    expect(original.achievements).toEqual(['green-genesis'])
  })

  it('keeps long Unicode duplicate names within the 40-character storage limit', () => {
    const copy = duplicateWorld({ ...world(), name: '🌍'.repeat(20) }, 'copy-id', 5000)
    expect(copy.name.length).toBeLessThanOrEqual(40)
    expect(decodeWorld(encodeWorld({ ...copy.initial, name: copy.name, seed: copy.seed })).name).toBe(copy.name)
  })
})
