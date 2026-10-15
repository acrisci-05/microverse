import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { WorldInput, WorldRecord } from '../types/world'
import { MAX_IMPORT_BYTES, object, validateCollection, validateInput, validateWorld } from './validation'

interface UniverseDatabase extends DBSchema {
  worlds: { key: string; value: WorldRecord; indexes: { 'by-updated': number } }
}

export const DATABASE_NAME = 'microverse-universe'
let connection: Promise<IDBPDatabase<UniverseDatabase>> | undefined

function database() {
  if (!connection) {
    // Browsers can throw synchronously when storage access is blocked.
    connection = Promise.resolve().then(() => openDB<UniverseDatabase>(DATABASE_NAME, 1, {
      upgrade(db) {
        const worlds = db.createObjectStore('worlds', { keyPath: 'id' })
        worlds.createIndex('by-updated', 'updatedAt')
      },
      blocking() {
        void connection?.then(db => db.close())
        connection = undefined
      },
      terminated() { connection = undefined },
    })).catch((error: unknown) => {
      connection = undefined
      throw new Error('Local storage is unavailable. Export your universe to keep a backup, then enable browser storage and try again.', { cause: error })
    })
  }
  return connection
}

export async function loadWorlds(): Promise<{ worlds: WorldRecord[]; warnings: string[] }> {
  const db = await database()
  const stored: unknown[] = await db.getAll('worlds')
  const worlds: WorldRecord[] = []
  const warnings: string[] = []
  stored.forEach((record, index) => {
    try { worlds.push(validateWorld(record)) }
    catch { warnings.push(`Saved world ${index + 1} could not be read. Its original record was kept in browser storage; other worlds are available.`) }
  })
  worlds.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  return { worlds, warnings }
}

export async function saveWorld(world: WorldRecord): Promise<void> {
  const valid = validateWorld(world)
  const db = await database()
  try { await db.put('worlds', valid) }
  catch (error) { throw new Error('Your world could not be saved. Browser storage may be full or disabled. Export a backup before closing this page.', { cause: error }) }
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await database()
  await db.delete('worlds', id)
}

export function exportWorlds(worlds: WorldRecord[]): string {
  const json = JSON.stringify({ format: 'microverse', version: 1, worlds: validateCollection(worlds) }, null, 2)
  if (new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) throw new Error('This universe exceeds the 10 MB backup limit. Export fewer worlds at a time.')
  return json
}

export function importWorlds(json: string): WorldRecord[] {
  if (typeof json !== 'string' || json.length > MAX_IMPORT_BYTES || new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) throw new Error('The backup must be no larger than 10 MB.')
  let parsed: unknown
  try { parsed = JSON.parse(json) }
  catch { throw new Error('This file is not valid JSON. Choose a MICROVERSE universe backup.') }
  const envelope = object(parsed, 'backup', ['format', 'version', 'worlds'])
  if (envelope.format !== 'microverse' || envelope.version !== 1) throw new Error('This backup format or version is not supported. Expected MICROVERSE version 1.')
  return validateCollection(envelope.worlds)
}

/** Sharing carries genesis conditions only; saved progress stays in universe backups. */
export function encodeWorld(input: WorldInput): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, initial: validateInput(input) }))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `MX1.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

export function decodeWorld(code: string): WorldInput {
  if (typeof code !== 'string' || code.length > 4096 || !/^MX1\.[A-Za-z0-9_-]+$/.test(code.trim())) throw new Error('Enter a valid MICROVERSE code beginning with MX1. (maximum 4096 characters).')
  try {
    const payload = code.trim().slice(4).replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(payload)
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
    const envelope = object(JSON.parse(json), 'share code', ['version', 'initial'])
    if (envelope.version !== 1) throw new Error('Unsupported version')
    return validateInput(envelope.initial)
  } catch { throw new Error('This world code is damaged or uses unsupported world conditions. Ask for a new code.') }
}

export function duplicateWorld(world: WorldRecord, id: string, now: number): WorldRecord {
  const copy = validateWorld(world)
  copy.id = id
  copy.name = `${copy.name.slice(0, 33).replace(/[\uD800-\uDBFF]$/, '').trimEnd()} · copy`
  copy.createdAt = now
  copy.updatedAt = now
  return validateWorld(copy)
}
