// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIONS } from '../data/ecology'
import { createWorld, DEFAULT_PARAMETERS, tickWorld } from '../engine'
import { Simulation } from '../features/simulation/Simulation'
import type { ActionId, WorldRecord, WorldState } from '../types/world'

vi.mock('../components/PlanetView', () => ({
  PlanetView: ({ state }: { state: WorldState }) =>
    <div role="img" aria-label="Rendered planet" data-state={JSON.stringify(state)} />,
}))
vi.mock('../three/PlanetThumbnail', () => ({ PlanetThumbnail: () => null }))

type SimulationProps = ComponentProps<typeof Simulation>
const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')

function makeWorld(cycles = 0): WorldRecord {
  let world = createWorld({ ...DEFAULT_PARAMETERS, name: 'Test planet', seed: 'simulation-ui' }, 'ui-world', 1_000)
  for (let i = 0; i < cycles; i++) world = tickWorld(world)
  return world
}

function setup(overrides: Partial<SimulationProps> = {}) {
  const props: SimulationProps = {
    world: makeWorld(), quality: 'low', autoRun: false, saveStatus: 'saved',
    onTick: vi.fn(), onAct: vi.fn<(id: ActionId) => string | undefined>(() => undefined),
    onBack: vi.fn(), onShare: vi.fn(), onDiscoveries: vi.fn(), ...overrides,
  }
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  return { ...render(<Simulation {...props} />), props, user }
}

function advance(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds) })
}

function setHidden(hidden: boolean, notify = true) {
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
    if (notify) document.dispatchEvent(new Event('visibilitychange'))
  })
}

function renderedState(): WorldState {
  return JSON.parse(screen.getByRole('img', { name: 'Rendered planet' }).getAttribute('data-state')!) as WorldState
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
  else Reflect.deleteProperty(document, 'hidden')
})

describe('simulation clock controls', () => {
  it('reopens a saved world paused and advances only after an explicit resume', async () => {
    const { props, user } = setup()
    advance(24_000)
    expect(props.onTick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Resume evolution' }))
    advance(2_399)
    expect(props.onTick).not.toHaveBeenCalled()
    advance(1)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Pause evolution' }))
    advance(12_000)
    expect(props.onTick).toHaveBeenCalledTimes(2)
  })

  it.each([[1, 2_400], [2, 1_200], [4, 600]])('advances precisely one cycle per interval at %ix speed', async (speed, interval) => {
    const { props, user } = setup({ autoRun: true })
    const speedButton = screen.getByRole('button', { name: `Evolution speed ${speed}x` })
    await user.click(speedButton)
    expect(speedButton.getAttribute('aria-pressed')).toBe('true')
    advance(interval - 1)
    expect(props.onTick).not.toHaveBeenCalled()
    advance(1)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    advance(interval * 2)
    expect(props.onTick).toHaveBeenCalledTimes(3)
  })

  it('replaces the old interval when speed changes instead of running two clocks', async () => {
    const { props, user } = setup({ autoRun: true })
    advance(1_000)
    await user.click(screen.getByRole('button', { name: 'Evolution speed 4x' }))
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(4)
  })

  it('advances one cycle and pauses automatic evolution', async () => {
    const { props, user } = setup({ autoRun: true })
    advance(1_000)
    await user.click(screen.getByRole('button', { name: 'Advance one cycle' }))
    expect(props.onTick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Resume evolution' })).toBeTruthy()
    advance(9_600)
    expect(props.onTick).toHaveBeenCalledTimes(1)
  })

  it('pauses when the tab is hidden and requires resume when it becomes visible', async () => {
    const { props, user } = setup({ autoRun: true })
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    setHidden(true)
    advance(24_000)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    setHidden(false)
    advance(24_000)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Resume evolution' }))
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(2)
  })

  it('guards against background ticks even before the visibility event is delivered', () => {
    const { props } = setup({ autoRun: true })
    setHidden(true, false)
    advance(7_200)
    expect(props.onTick).not.toHaveBeenCalled()
  })

  it('uses the latest tick callback after a parent render', () => {
    const { props, rerender } = setup({ autoRun: true })
    advance(2_400)
    const latestTick = vi.fn()
    rerender(<Simulation {...props} onTick={latestTick} />)
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    expect(latestTick).toHaveBeenCalledTimes(1)
  })

  it('cancels the clock when leaving the simulation', () => {
    const { props, unmount } = setup({ autoRun: true })
    advance(2_400)
    unmount()
    advance(24_000)
    expect(props.onTick).toHaveBeenCalledTimes(1)
  })
})

describe('intervention controls', () => {
  it('dispatches the selected intervention and announces its result without mutating props', async () => {
    const world = makeWorld()
    const original = structuredClone(world)
    const { props, user } = setup({ world })
    await user.click(screen.getByRole('button', { name: /^Seed Forests,/ }))
    expect(props.onAct).toHaveBeenCalledExactlyOnceWith('forest')
    expect(screen.getByRole('status').textContent).toContain('Seed Forests')
    expect(screen.getByRole('status').textContent).toContain('+18 vegetation')
    expect(world).toEqual(original)
    expect(renderedState()).toEqual(world.state)
  })

  it('disables actions above the available energy while allowing an exact-cost action', async () => {
    const world = makeWorld()
    world.state.energy = 24
    const { props, user } = setup({ world })
    for (const action of ACTIONS) {
      const button = screen.getByRole('button', { name: new RegExp(`^${action.name},`) }) as HTMLButtonElement
      expect(button.disabled, action.name).toBe(action.cost > 24)
    }
    await user.click(screen.getByRole('button', { name: /^Protect Biodiversity,/ }))
    expect(props.onAct).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Restore Oceans,/ }))
    expect(props.onAct).toHaveBeenCalledExactlyOnceWith('ocean')
  })

  it('shows an engine refusal instead of pretending the intervention succeeded', async () => {
    const refusal = 'Settlements need a healthy coastline.'
    const onAct = vi.fn<(id: ActionId) => string | undefined>(() => refusal)
    const { user } = setup({ onAct })
    await user.click(screen.getByRole('button', { name: /^Develop Settlements,/ }))
    expect(onAct).toHaveBeenCalledExactlyOnceWith('settlement')
    expect(screen.getByRole('status').textContent).toBe(refusal)
    advance(5_000)
    expect(screen.getByRole('status').textContent).toBe('')
  })
})

describe('chronicle memories', () => {
  it('shows the selected historical state, pauses evolution, and protects the live world', async () => {
    const world = makeWorld(6)
    const original = structuredClone(world)
    const { props, user } = setup({ world, autoRun: true })
    expect(renderedState()).toEqual(world.state)
    await user.click(screen.getByRole('button', { name: /CYCLE 000/ }))

    expect(renderedState()).toEqual(world.chronicle[0].snapshot)
    expect((screen.getByRole('button', { name: 'Resume evolution' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Advance one cycle' }) as HTMLButtonElement).disabled).toBe(true)
    for (const action of ACTIONS) {
      expect((screen.getByRole('button', { name: new RegExp(`^${action.name},`) }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect(screen.getByText(/Read-only memory/)).toBeTruthy()
    expect(window.scrollTo).toHaveBeenCalled()
    advance(24_000)
    expect(props.onTick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Seed Forests,/ }))
    expect(props.onAct).not.toHaveBeenCalled()
    expect(world).toEqual(original)

    await user.click(screen.getByRole('button', { name: 'Return to present' }))
    expect(renderedState()).toEqual(original.state)
    expect((screen.getByRole('button', { name: 'Resume evolution' }) as HTMLButtonElement).disabled).toBe(false)
    advance(2_400)
    expect(props.onTick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Resume evolution' }))
    advance(2_400)
    expect(props.onTick).toHaveBeenCalledTimes(1)
    expect(world).toEqual(original)
  })

  it('returns to the current state when a selected milestone is toggled off', async () => {
    const world = makeWorld(6)
    const { user } = setup({ world })
    const genesis = screen.getByRole('button', { name: /CYCLE 000/ })
    await user.click(genesis)
    expect(genesis.getAttribute('aria-pressed')).toBe('true')
    expect(renderedState().cycle).toBe(0)
    await user.click(genesis)
    expect(genesis.getAttribute('aria-pressed')).toBe('false')
    expect(renderedState()).toEqual(world.state)
    expect(screen.queryByText(/Read-only memory/)).toBeNull()
  })
})
