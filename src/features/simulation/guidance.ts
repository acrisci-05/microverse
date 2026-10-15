import type { ActionId, WorldState } from '../../types/world'

export function worldGuidance(state: WorldState): { text: string; action: ActionId } {
  if (state.temperature < 0)
    return {
      text: 'The cold is slowing growth. Regulate heat to give the first forests a chance.',
      action: 'heat',
    }
  if (state.temperature > 35)
    return {
      text: 'Heat is putting life under pressure. Regulate heat before the ground dries out.',
      action: 'heat',
    }
  if (state.water < 40)
    return {
      text: 'Water is scarce. Restore oceans to replenish the coasts and support new growth.',
      action: 'ocean',
    }
  if (state.water > 80)
    return {
      text: 'Life has little land to grow on. Restore oceans also draws excess water toward a balanced level.',
      action: 'ocean',
    }
  if (state.pollution > 25)
    return {
      text: 'Pollution is beginning to outweigh growth. Protect biodiversity to clean up habitats.',
      action: 'protect',
    }
  if (state.vegetation < 55)
    return {
      text: 'A stronger canopy will shelter animal life. Seed forests, then allow a few cycles for growth.',
      action: 'forest',
    }
  if (state.biodiversity < 60 || state.lifePotential < 80)
    return {
      text: 'Your habitats can support more life. Introduce species to build a richer food web.',
      action: 'species',
    }
  if (state.civilization < 12 && state.resources >= 25)
    return {
      text: 'Life is established. Develop a settlement, then watch its demands on resources and clean air.',
      action: 'settlement',
    }
  return {
    text: 'Your world has room to breathe. Let time pass and protect biodiversity as civilization grows.',
    action: 'protect',
  }
}
