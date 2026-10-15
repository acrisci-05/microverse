import type { ChronicleEntry, WorldRecord, WorldState } from '../types/world'
import { ecologicalStability, isCrisis } from './ecology'
import { boundState, randomStep } from './math'

interface EventDefinition {
  id: string
  title: string
  description: string
  impact: string
  tone: ChronicleEntry['tone']
  condition: (state: WorldState) => boolean
  chance?: number
  effects: Partial<WorldState>
}

/** Effects are deltas, applied before the snapshot is stored. All events are one-time milestones. */
export const WORLD_EVENTS: readonly EventDefinition[] = [
  { id: 'ecological-crisis', title: 'Ecological Crisis', description: 'The web of life is fraying. Genesis energy arrives to give this world another chance.', impact: '−4 vegetation · −5 biodiversity · −3 fertility · +16 Genesis energy', tone: 'warning', condition: s => s.cycle >= 1 && isCrisis(s), effects: { vegetation: -4, biodiversity: -5, fertility: -3, energy: 16 } },
  { id: 'first-rainfall', title: 'First Rainfall', description: 'Clouds gather. For the first time, rain finds the waiting soil.', impact: '+8 humidity · +4 fertility · +0.6 water', tone: 'positive', condition: s => s.cycle >= 2 && s.humidity >= 35 && s.temperature > 0 && s.water >= 18, effects: { humidity: 8, fertility: 4, water: 0.6 } },
  { id: 'forest-awakening', title: 'Forest Awakening', description: 'Separate patches of green become a living canopy. The world begins to breathe.', impact: '+5 vegetation · +3 biodiversity', tone: 'positive', condition: s => s.cycle >= 4 && s.vegetation >= 43, effects: { vegetation: 5, biodiversity: 3 } },
  { id: 'ice-expansion', title: 'Ice Expansion', description: 'Pale ice spreads beyond the poles. The cold preserves water but silences the soil.', impact: '−2°C · −4 vegetation · −3 fertility', tone: 'warning', condition: s => s.cycle >= 3 && s.temperature <= -6, effects: { temperature: -2, vegetation: -4, fertility: -3 } },
  { id: 'volcanic-activity', title: 'Volcanic Activity', description: 'A restless mantle breaks the surface. New minerals arrive at a cost to nearby forests.', impact: '+3°C · +14 resources · +10 fertility · −6 vegetation · volcanic glow', tone: 'warning', condition: s => s.cycle >= 8 && s.resources < 93 && s.gravity >= 0.65, chance: 0.1, effects: { temperature: 3, resources: 14, fertility: 10, vegetation: -6, volcanicActivity: 80 } },
  { id: 'great-drought', title: 'Great Drought', description: 'Rivers retreat and the canopy thins. Rebalance the seas before the soil loses its memory.', impact: '−4 water · −6 fertility · −8 vegetation', tone: 'warning', condition: s => s.cycle >= 3 && (s.water < 28 || (s.temperature > 39 && s.humidity < 50)), effects: { water: -4, fertility: -6, vegetation: -8 } },
  { id: 'species-emergence', title: 'Species Emergence', description: 'A new branch of life finds its place beneath the canopy. The food web grows richer.', impact: '+7 animals · +5 biodiversity', tone: 'positive', condition: s => s.cycle >= 6 && s.biodiversity >= 26 && s.vegetation >= 25, effects: { animals: 7, biodiversity: 5 } },
  { id: 'biodiversity-bloom', title: 'Biodiversity Bloom', description: 'Life fills the spaces between habitats. The ecosystem becomes more than the sum of its parts.', impact: '+6 biodiversity · +4 fertility · +10 Genesis energy', tone: 'positive', condition: s => s.cycle >= 10 && s.biodiversity >= 62 && s.stability >= 67, effects: { biodiversity: 6, fertility: 4, energy: 10 } },
  { id: 'meteor-shower', title: 'Meteor Shower', description: 'Streaks of ancient light cross the atmosphere, delivering minerals and scattering a few forests.', impact: '+12 resources · −4 vegetation · −2 humidity · +1°C', tone: 'neutral', condition: s => s.cycle >= 18 && s.resources < 97, chance: 0.055, effects: { resources: 12, vegetation: -4, humidity: -2, temperature: 1 } },
  { id: 'coastal-settlement', title: 'Coastal Settlement', description: 'Along a sheltered shore, the first lights appear. A new kind of life begins to shape the world.', impact: '+12 civilization · +4 technology · −6 resources · +3 pollution', tone: 'positive', condition: s => s.cycle >= 16 && s.civilization < 12 && s.water >= 35 && s.water <= 82 && s.temperature >= 4 && s.temperature <= 35 && s.vegetation >= 45 && s.biodiversity >= 38 && s.stability >= 60, chance: 0.18, effects: { civilization: 12, technology: 4, resources: -6, pollution: 3 } },
]

export function appendChronicle(chronicle: ChronicleEntry[], entry: ChronicleEntry): ChronicleEntry[] {
  const entries = [...chronicle, entry]
  // Retain every milestone; prune the oldest intervention when the history grows.
  if (entries.length > 180) {
    const oldestAction = entries.findIndex(item => item.eventId.startsWith('action-'))
    entries.splice(oldestAction >= 0 ? oldestAction : 1, 1)
  }
  return entries
}

export function runEvents(world: WorldRecord): WorldRecord {
  let state = { ...world.state }
  let chronicle = world.chronicle
  let occurred = 0
  for (const event of WORLD_EVENTS) {
    if (occurred >= 2 || chronicle.some(entry => entry.eventId === event.id) || !event.condition(state)) continue
    if (event.chance !== undefined) {
      const random = randomStep(state.rngState)
      state.rngState = random.state
      if (random.value >= event.chance) continue
    }
    const changed = { ...state }
    for (const [key, delta] of Object.entries(event.effects)) {
      const field = key as keyof Pick<WorldState, 'vegetation' | 'biodiversity' | 'fertility' | 'energy' | 'humidity' | 'water' | 'temperature' | 'resources' | 'volcanicActivity' | 'animals' | 'civilization' | 'technology' | 'pollution'>
      changed[field] += delta as number
    }
    state = boundState(changed)
    state.stability = ecologicalStability(state)
    state.wasInCrisis ||= isCrisis(state)
    chronicle = appendChronicle(chronicle, {
      id: `${world.id}:${state.cycle}:${event.id}`, eventId: event.id,
      cycle: state.cycle, title: event.title, description: event.description,
      impact: event.impact, tone: event.tone, snapshot: { ...state },
    })
    occurred++
  }
  return { ...world, state, chronicle }
}
