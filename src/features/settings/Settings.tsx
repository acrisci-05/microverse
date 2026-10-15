import { useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Download,
  HardDrive,
  Monitor,
  RefreshCw,
} from 'lucide-react'
import { importWorlds } from '../../persistence'
import { downloadBackup } from '../../utils/downloadBackup'
import type { Quality, WorldRecord } from '../../types/world'

interface SettingsProps {
  worlds: WorldRecord[]
  quality: Quality
  reducedMotion: boolean
  onQuality: (quality: Quality) => void
  onMotion: (reduced: boolean) => void
  onImport: (worlds: WorldRecord[]) => void
  pwa: {
    offlineReady: boolean
    updateReady: boolean
    installed: boolean
    canInstall: boolean
    install: () => Promise<void>
    update: () => Promise<void> | undefined
  }
  saveStatus: string
}
export function Settings({
  worlds,
  quality,
  reducedMotion,
  onQuality,
  onMotion,
  onImport,
  pwa,
  saveStatus,
}: SettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [feedback, setFeedback] = useState('')
  const download = () => {
    try {
      downloadBackup(worlds)
      setFeedback(
        `Backup exported with ${worlds.length} ${worlds.length === 1 ? 'world' : 'worlds'}.`,
      )
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not export your universe.')
    }
  }
  return (
    <main id="main" className="settings page-enter section-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h1>Your observatory.</h1>
          <p>A few adjustments for your corner of the cosmos.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>
            <Monitor size={19} />
            The experience
          </h2>
          <div className="setting-row">
            <div>
              <h3>Planet quality</h3>
              <p>Auto adapts detail and resolution to your screen. Low reduces GPU load.</p>
            </div>
            <div className="segmented-control">
              {(['auto', 'low', 'high'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={quality === value}
                  className={quality === value ? 'selected' : ''}
                  onClick={() => onQuality(value)}
                >
                  {value === 'high' ? 'High · HD' : value}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <div>
              <h3>Less motion</h3>
              <p>
                Keep the cosmos still. Your device’s reduced motion preference is also respected.
              </p>
            </div>
            <button
              role="switch"
              aria-label="Reduce motion"
              aria-checked={reducedMotion}
              className={`toggle ${reducedMotion ? 'on' : ''}`}
              onClick={() => onMotion(!reducedMotion)}
            >
              <span />
            </button>
          </div>
        </section>
        <section className="settings-section">
          <h2>
            <HardDrive size={19} />A universe worth keeping
          </h2>
          <p>
            Your {worlds.length} {worlds.length === 1 ? 'world is' : 'worlds are'} saved in this
            browser on this device. Export a backup before clearing browser data or moving to
            another device.
          </p>
          <div className="backup-actions">
            <button className="button" onClick={download} disabled={!worlds.length}>
              <ArrowDownToLine size={17} />
              Export universe
            </button>
            <button className="button" onClick={() => fileRef.current?.click()}>
              <ArrowUpFromLine size={17} />
              Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".json,application/json"
              aria-label="Import universe backup"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  if (file.size > 10 * 1024 * 1024)
                    throw new Error('Choose a backup smaller than 10 MB.')
                  const records = importWorlds(await file.text())
                  if (worlds.length + records.length > 100)
                    throw new Error(
                      'A universe can hold up to 100 worlds. Export and remove some worlds first.',
                    )
                  onImport(records)
                  setFeedback(`Imported ${records.length} worlds as independent copies.`)
                } catch (error) {
                  setFeedback(
                    error instanceof Error ? error.message : 'This backup could not be read.',
                  )
                } finally {
                  event.target.value = ''
                }
              }}
            />
          </div>
          <p className="settings-footnote">
            Importing creates independent copies and preserves your existing worlds.
          </p>
        </section>
        <section className="settings-section">
          <h2>
            <Download size={19} />
            Take your universe with you
          </h2>
          <p>
            {pwa.installed
              ? 'MICROVERSE is installed. Your worlds are ready for their next chapter.'
              : 'Install MICROVERSE for a quiet, full-screen space of its own.'}
          </p>
          {pwa.canInstall ? (
            <button className="button button-primary" onClick={() => void pwa.install()}>
              Install MICROVERSE
              <Download size={17} />
            </button>
          ) : (
            <p className="settings-footnote">
              {pwa.installed
                ? 'Installed on this device.'
                : 'In a supported browser, use Install app or Add to Home Screen from the browser menu. On iOS, use Safari’s Share menu.'}
            </p>
          )}
          <div className="offline-state">
            <span className={`status-dot ${pwa.offlineReady ? '' : 'paused'}`} />
            {pwa.offlineReady
              ? 'Essential files are ready offline.'
              : import.meta.env.DEV
                ? 'Offline installation is available in the production build.'
                : 'Offline files will be ready after the first successful load.'}
          </div>
          {pwa.updateReady && (
            <button
              className="button"
              disabled={saveStatus !== 'saved'}
              onClick={() => void pwa.update()}
            >
              <RefreshCw size={16} />
              Apply available update
            </button>
          )}
        </section>
        <section className="settings-section about-section">
          <h2>A tiny planet. Endless consequences.</h2>
          <p>
            MICROVERSE is a small, deterministic ecosystem game. Its ecology is a stylized model
            made for discovery, not a scientific prediction.
          </p>
          <p>
            Time moves only while your world is open and evolution is running. Leaving the page or
            switching tabs pauses the simulation. Returning worlds start paused.
          </p>
          <span className="eyebrow">MICROVERSE / EDITION 001</span>
        </section>
      </div>
      <div className="settings-feedback" role="status">
        {feedback && (
          <>
            <Check size={16} />
            {feedback}
          </>
        )}
      </div>
    </main>
  )
}
