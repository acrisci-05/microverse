// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUniverse } from '../hooks/useUniverse'
import { createWorld } from '../engine'
import { BLUEPRINTS } from '../data/blueprints'
import { loadWorlds, saveWorld, deleteWorld, duplicateWorld } from '../persistence'

vi.mock('../persistence', () => ({
  loadWorlds: vi.fn(),
  saveWorld: vi.fn(),
  deleteWorld: vi.fn(),
  duplicateWorld: vi.fn(),
}))
const stored = () => createWorld(BLUEPRINTS[0], 'test-world', 1)
beforeEach(() => {
  vi.mocked(loadWorlds).mockResolvedValue({ worlds: [], warnings: [] })
  vi.mocked(saveWorld).mockResolvedValue(undefined)
  vi.mocked(deleteWorld).mockResolvedValue(undefined)
  vi.mocked(duplicateWorld).mockImplementation((world, id, now) =>
    structuredClone({ ...world, id, createdAt: now, updatedAt: now }),
  )
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('universe command and persistence integration', () => {
  it('creates a world, advances discrete cycles and persists the latest state', async () => {
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    let id = ''
    act(() => {
      id = result.current.create(BLUEPRINTS[0])!.id
    })
    act(() => {
      result.current.tick(id)
      result.current.tick(id)
    })
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(result.current.worlds[0].state.cycle).toBe(2)
    expect(saveWorld).toHaveBeenCalledTimes(3)
    expect(vi.mocked(saveWorld).mock.calls.at(-1)?.[0].state.cycle).toBe(2)
  })

  it('keeps gameplay in memory after a save failure and retries it explicitly', async () => {
    vi.mocked(saveWorld).mockRejectedValueOnce(new Error('quota exceeded'))
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => {
      result.current.create(BLUEPRINTS[0])
    })
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))
    expect(result.current.worlds).toHaveLength(1)
    expect(result.current.error).toContain('Export a backup')
    act(() => result.current.retrySave())
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(result.current.error).toBe('')
    expect(saveWorld).toHaveBeenCalledTimes(2)
  })

  it('keeps the world when deleting from storage fails', async () => {
    vi.mocked(loadWorlds).mockResolvedValue({ worlds: [stored()], warnings: [] })
    vi.mocked(deleteWorld).mockRejectedValueOnce(new Error('storage disabled'))
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.remove('test-world'))
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))
    expect(result.current.worlds).toHaveLength(1)
    expect(result.current.error).toContain('could not be deleted')
  })

  it('removes a world only after its durable deletion succeeds', async () => {
    vi.mocked(loadWorlds).mockResolvedValue({ worlds: [stored()], warnings: [] })
    let resolveDelete!: () => void
    vi.mocked(deleteWorld).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        }),
    )
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => result.current.remove('test-world'))
    await waitFor(() => expect(deleteWorld).toHaveBeenCalledOnce())
    expect(result.current.worlds).toHaveLength(1)
    await act(async () => resolveDelete())
    await waitFor(() => expect(result.current.worlds).toHaveLength(0))
  })

  it('rejects actions that do not meet prerequisites without saving a fake intervention', async () => {
    const world = stored()
    world.state.energy = 0
    vi.mocked(loadWorlds).mockResolvedValue({ worlds: [world], warnings: [] })
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    let error: string | undefined
    act(() => {
      error = result.current.act(world.id, 'forest')
    })
    expect(error).toContain('Genesis energy')
    expect(saveWorld).not.toHaveBeenCalled()
    expect(result.current.worlds[0].state).toEqual(world.state)
  })

  it('enforces the collection limit in commands, including direct creator routes', async () => {
    const records = Array.from({ length: 100 }, (_, index) =>
      createWorld(BLUEPRINTS[0], `world-${index}`, 1),
    )
    vi.mocked(loadWorlds).mockResolvedValue({ worlds: records, warnings: [] })
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => {
      expect(result.current.create(BLUEPRINTS[1])).toBeUndefined()
    })
    expect(result.current.worlds).toHaveLength(100)
    expect(result.current.error).toContain('100 worlds')
    expect(() => result.current.importRecords([stored()])).toThrow('100 worlds')
    expect(saveWorld).not.toHaveBeenCalled()
  })

  it('reports an unavailable database without blocking a playable in-memory world', async () => {
    vi.mocked(loadWorlds).mockRejectedValueOnce(new Error('disabled'))
    const { result } = renderHook(useUniverse)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.saveStatus).toBe('error')
    act(() => {
      result.current.create(BLUEPRINTS[0])
    })
    expect(result.current.worlds).toHaveLength(1)
    act(() => result.current.retrySave())
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
  })
})
