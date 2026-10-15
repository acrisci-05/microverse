import { exportWorlds } from '../persistence'
import type { WorldRecord } from '../types/world'

export function downloadBackup(worlds: WorldRecord[], filename = 'microverse-backup') {
  const json = exportWorlds(worlds)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80)}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
