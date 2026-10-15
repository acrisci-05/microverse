export type Quality = 'auto' | 'low' | 'high'

export interface WorldParameters {
  water: number
  temperature: number
  solar: number
  gravity: number
  lifePotential: number
}

export interface WorldInput extends WorldParameters {
  name: string
  seed: string
}

/** Percentages use 0–100, temperature °C, gravity Earth g, solar relative %. */
export interface WorldState extends WorldParameters {
  cycle: number
  humidity: number
  vegetation: number
  biodiversity: number
  animals: number
  fertility: number
  resources: number
  technology: number
  civilization: number
  pollution: number
  stability: number
  energy: number
  rngState: number
  balancedCycles: number
  oceanCycles: number
  wasInCrisis: boolean
  recovered: boolean
  volcanicActivity: number
}

export interface ChronicleEntry {
  id: string
  eventId: string
  cycle: number
  title: string
  description: string
  impact: string
  tone: 'neutral' | 'positive' | 'warning'
  snapshot: WorldState
}

export interface WorldRecord {
  schemaVersion: 1
  id: string
  name: string
  seed: string
  createdAt: number
  updatedAt: number
  initial: WorldParameters
  state: WorldState
  chronicle: ChronicleEntry[]
  achievements: string[]
}

export type ActionId = 'forest' | 'ocean' | 'heat' | 'species' | 'protect' | 'settlement'
export interface ActionDefinition {
  id: ActionId
  name: string
  description: string
  cost: number
  effect: string
}
export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: 'sprout' | 'waves' | 'shield' | 'city' | 'orbit' | 'heart'
}
export interface ActionResult { world: WorldRecord; error?: string }
