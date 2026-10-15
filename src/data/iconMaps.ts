import {
  Building2,
  Heart,
  Orbit,
  ShieldCheck,
  Sprout,
  Waves,
  Thermometer,
  Dna,
  Leaf,
} from 'lucide-react'
import type { ActionId, AchievementDefinition } from '../types/world'

export const actionIcons = {
  forest: Sprout,
  ocean: Waves,
  heat: Thermometer,
  species: Dna,
  protect: ShieldCheck,
  settlement: Building2,
} satisfies Record<ActionId, typeof Leaf>
export const achievementIcons = {
  sprout: Sprout,
  waves: Waves,
  shield: ShieldCheck,
  city: Building2,
  orbit: Orbit,
  heart: Heart,
} satisfies Record<AchievementDefinition['icon'], typeof Leaf>
