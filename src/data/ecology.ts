import type { AchievementDefinition, ActionDefinition } from '../types/world'

export const ACTIONS: ActionDefinition[] = [
  { id: 'forest', name: 'Seed Forests', description: 'Plant a canopy that shelters life and absorbs pollution.', cost: 18, effect: '+18 vegetation · +4 biodiversity · −2 water' },
  { id: 'ocean', name: 'Restore Oceans', description: 'Rebalance water toward 64% coverage and replenish fertile coasts.', cost: 24, effect: 'Water toward 64% · +8 fertility · +6 humidity' },
  { id: 'heat', name: 'Regulate Heat', description: 'Guide the climate toward 18°C and moderate incoming sunlight.', cost: 20, effect: 'Temperature toward 18°C · sunlight toward 100%' },
  { id: 'species', name: 'Introduce Species', description: 'Bring new life to the food web. A healthy habitat helps it survive.', cost: 24, effect: '+14 biodiversity · +8 animals · +16 life potential' },
  { id: 'protect', name: 'Protect Biodiversity', description: 'Clean up industry and restore protected habitats.', cost: 26, effect: '−20 pollution · +10 biodiversity · +8 fertility' },
  { id: 'settlement', name: 'Develop Settlements', description: 'Build where life can thrive. Settlements consume resources and produce pollution.', cost: 32, effect: '+18 civilization · +6 technology · −12 resources · +6 pollution' },
]

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'green-genesis', name: 'Green Genesis', description: 'Reach 70% vegetation coverage.', icon: 'sprout' },
  { id: 'ocean-keeper', name: 'Ocean Keeper', description: 'Keep water at 50–80%, humidity at least 45%, and stability at least 65% for 12 cycles.', icon: 'waves' },
  { id: 'against-the-odds', name: 'Against the Odds', description: 'After a crisis, regain 45% stability and 20% biodiversity in a temperate climate.', icon: 'shield' },
  { id: 'first-civilization', name: 'The First Civilization', description: 'Establish a civilization of at least 12%.', icon: 'city' },
  { id: 'perfect-balance', name: 'Perfect Balance', description: 'Maintain at least 80% stability for 16 consecutive cycles.', icon: 'orbit' },
  { id: 'second-chance', name: 'Second Chance', description: 'Recover a world from crisis to 68% stability, 45% vegetation, and 45% biodiversity.', icon: 'heart' },
]
