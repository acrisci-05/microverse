import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorld, tickWorld, applyAction } from '../engine'
import {
  loadWorlds,
  saveWorld,
  deleteWorld as removeSavedWorld,
  duplicateWorld,
} from '../persistence'
import type { ActionId, WorldInput, WorldRecord } from '../types/world'

export function useUniverse() {
  const [worlds, setWorlds] = useState<WorldRecord[]>([])
  const worldsRef = useRef(worlds)
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState('')
  const queue = useRef(Promise.resolve())
  const pending = useRef(0)
  const failed = useRef(false)

  useEffect(() => {
    let live = true
    loadWorlds()
      .then((result) => {
        if (!live) return
        worldsRef.current = result.worlds
        setWorlds(result.worlds)
        if (result.warnings.length) setError(result.warnings.join(' '))
      })
      .catch(() => {
        if (live) {
          setError(
            'Your local storage is unavailable. You can play, but export a backup before leaving.',
          )
          setSaveStatus('error')
          failed.current = true
        }
      })
      .finally(() => {
        if (live) setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [])

  const enqueue = useCallback(
    (
      operation: () => Promise<void>,
      failureMessage = 'A local save failed. Your world is still in memory. Export a backup in Settings before leaving.',
    ) => {
      pending.current += 1
      setSaveStatus('saving')
      queue.current = queue.current
        .then(operation)
        .catch(() => {
          failed.current = true
          setError(failureMessage)
        })
        .finally(() => {
          pending.current -= 1
          setSaveStatus(failed.current ? 'error' : pending.current ? 'saving' : 'saved')
        })
    },
    [],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current > 0 || failed.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const commit = useCallback(
    (world: WorldRecord) => {
      if (!worldsRef.current.some((w) => w.id === world.id) && worldsRef.current.length >= 100) {
        setError(
          'Your universe can hold up to 100 worlds. Export a backup and remove a world before adding another.',
        )
        return undefined
      }
      const updated = { ...world, updatedAt: Date.now() }
      const next = worldsRef.current.some((w) => w.id === updated.id)
        ? worldsRef.current.map((w) => (w.id === updated.id ? updated : w))
        : [...worldsRef.current, updated]
      worldsRef.current = next
      setWorlds(next)
      enqueue(() => saveWorld(updated))
      return updated
    },
    [enqueue],
  )

  const create = useCallback(
    (input: WorldInput) => commit(createWorld(input, crypto.randomUUID(), Date.now())),
    [commit],
  )
  const tick = useCallback(
    (id: string) => {
      const world = worldsRef.current.find((w) => w.id === id)
      if (world) commit(tickWorld(world))
    },
    [commit],
  )
  const act = useCallback(
    (id: string, action: ActionId) => {
      const world = worldsRef.current.find((w) => w.id === id)
      if (!world) return 'World not found.'
      const result = applyAction(world, action)
      if (!result.error) commit(result.world)
      return result.error
    },
    [commit],
  )
  const rename = useCallback(
    (id: string, name: string) => {
      const world = worldsRef.current.find((w) => w.id === id)
      if (world && name.trim()) commit({ ...world, name: name.trim().slice(0, 40) })
    },
    [commit],
  )
  const duplicate = useCallback(
    (id: string) => {
      const world = worldsRef.current.find((w) => w.id === id)
      if (world) return commit(duplicateWorld(world, crypto.randomUUID(), Date.now()))
    },
    [commit],
  )
  const remove = useCallback(
    (id: string) => {
      enqueue(async () => {
        await removeSavedWorld(id)
        worldsRef.current = worldsRef.current.filter((w) => w.id !== id)
        setWorlds(worldsRef.current)
      }, 'This world could not be deleted from local storage. It has been kept in your universe; try again when storage is available.')
    },
    [enqueue],
  )
  const importRecords = useCallback(
    (records: WorldRecord[]) => {
      if (worldsRef.current.length + records.length > 100) {
        throw new Error(
          'Your universe can hold up to 100 worlds. Export and remove some worlds first.',
        )
      }
      records.forEach((record) =>
        commit({
          ...record,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      )
    },
    [commit],
  )
  const retrySave = useCallback(() => {
    enqueue(async () => {
      for (const world of worldsRef.current) await saveWorld(world)
      failed.current = false
      setError('')
    })
  }, [enqueue])
  return {
    worlds,
    loaded,
    saveStatus,
    error,
    clearError: () => setError(''),
    retrySave,
    create,
    tick,
    act,
    rename,
    duplicate,
    remove,
    importRecords,
  }
}
