import { useState } from 'react'
import {
  ArrowRight,
  Copy,
  Download,
  GitCompareArrows,
  MoreHorizontal,
  Orbit,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react'
import { PlanetThumbnail } from '../../three/PlanetThumbnail'
import { Modal } from '../../components/Modal'
import { worldStatus } from '../../engine'
import { copy } from '../../data/copy'
import { downloadBackup } from '../../utils/downloadBackup'
import type { WorldRecord } from '../../types/world'

export function Universe({
  worlds,
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onRemove,
  onShare,
  onCompare,
  onImport,
}: {
  worlds: WorldRecord[]
  onCreate: () => void
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onShare: (world: WorldRecord) => void
  onCompare: () => void
  onImport: () => void
}) {
  const [sort, setSort] = useState('recent')
  const [menu, setMenu] = useState<string | null>(null)
  const [rename, setRename] = useState<WorldRecord | null>(null)
  const [name, setName] = useState('')
  const [remove, setRemove] = useState<WorldRecord | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const sorted = [...worlds].sort((a, b) =>
    sort === 'stability'
      ? b.state.stability - a.state.stability
      : sort === 'cycles'
        ? b.state.cycle - a.state.cycle
        : b.updatedAt - a.updatedAt,
  )
  return (
    <main id="main" className="universe page-enter section-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR OWN CORNER OF THE COSMOS</p>
          <h1>
            My universe
            <span className="count-label">
              {worlds.length} {worlds.length === 1 ? 'world' : 'worlds'}
            </span>
          </h1>
          <p>Worlds you made. Stories still unfolding.</p>
        </div>
        <button className="button button-primary" onClick={onCreate}>
          <Plus size={18} />
          Create a world
        </button>
      </div>
      <div className="collection-toolbar">
        <div>
          <button className="button button-small" onClick={onImport}>
            <Plus size={15} />
            Import origin
          </button>
          <button
            className="button button-small"
            onClick={onCompare}
            disabled={worlds.length < 2}
            title={worlds.length < 2 ? 'Create two worlds to compare them' : 'Compare your worlds'}
          >
            <GitCompareArrows size={16} />
            Compare worlds
          </button>
        </div>
        <label>
          Sort by{' '}
          <select
            aria-label="Sort worlds"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">Recently changed</option>
            <option value="stability">Ecological stability</option>
            <option value="cycles">Cycles elapsed</option>
          </select>
        </label>
      </div>
      {backupMessage && (
        <p className="collection-feedback" role="status">
          {backupMessage}
        </p>
      )}
      {!worlds.length ? (
        <div className="empty-universe">
          <div className="empty-orbit">
            <Orbit size={60} />
            <span />
          </div>
          <p className="eyebrow">CYCLE 000</p>
          <h2>{copy.empty.title}</h2>
          <p>{copy.empty.body}</p>
          <button className="button button-primary" onClick={onCreate}>
            Create your first world
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <div className="world-grid">
          {sorted.map((world) => (
            <article className="world-card" key={world.id}>
              <div className="world-card-top">
                <span className="world-status">
                  <span className="status-dot" />
                  {worldStatus(world.state)}
                </span>
                <div className="world-menu-wrap">
                  <button
                    className="icon-button"
                    aria-label={`Manage ${world.name}`}
                    aria-expanded={menu === world.id}
                    onClick={() => setMenu(menu === world.id ? null : world.id)}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {menu === world.id && (
                    <div className="world-menu">
                      <button
                        onClick={() => {
                          setName(world.name)
                          setRename(world)
                          setMenu(null)
                        }}
                      >
                        <Pencil size={15} />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          onDuplicate(world.id)
                          setMenu(null)
                        }}
                      >
                        <Copy size={15} />
                        Duplicate
                      </button>
                      <button
                        onClick={() => {
                          onShare(world)
                          setMenu(null)
                        }}
                      >
                        <Share2 size={15} />
                        Share origin
                      </button>
                      <button
                        onClick={() => {
                          try {
                            downloadBackup([world], `microverse-${world.name}`)
                            setBackupMessage(`Backup exported for ${world.name}.`)
                          } catch (error) {
                            setBackupMessage(
                              error instanceof Error
                                ? error.message
                                : 'Could not export this world.',
                            )
                          }
                          setMenu(null)
                        }}
                      >
                        <Download size={15} />
                        Export backup
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => {
                          setRemove(world)
                          setMenu(null)
                        }}
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                className="world-card-open"
                onClick={() => onOpen(world.id)}
                aria-label={`Open ${world.name}`}
              >
                <PlanetThumbnail seed={world.seed} state={world.state} size={280} />
                <div className="world-card-name">
                  <div>
                    <span className="eyebrow">
                      CYCLE {String(world.state.cycle).padStart(3, '0')}
                    </span>
                    <h2>{world.name}</h2>
                  </div>
                  <ArrowRight size={22} />
                </div>
              </button>
              <div className="world-card-stats">
                <div>
                  <span>Temperature</span>
                  <strong>{Math.round(world.state.temperature)}°C</strong>
                </div>
                <div>
                  <span>Biodiversity</span>
                  <strong>{Math.round(world.state.biodiversity)}%</strong>
                </div>
                <div>
                  <span>Stability</span>
                  <strong>{Math.round(world.state.stability)}%</strong>
                </div>
              </div>
              <div className="world-card-footer">
                <span>{world.achievements.length} discoveries</span>
                <span>
                  {new Date(world.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </article>
          ))}
          <button className="new-world-card" onClick={onCreate}>
            <Plus size={27} />
            <h3>Another possibility.</h3>
            <p>
              A different beginning.
              <br />
              An unwritten story.
            </p>
            <span>
              Create a world
              <ArrowRight size={15} />
            </span>
          </button>
        </div>
      )}
      {rename && (
        <Modal title="A new name. The same world." onClose={() => setRename(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onRename(rename.id, name)
              setRename(null)
            }}
          >
            <label className="field-label" htmlFor="rename-world">
              World name
            </label>
            <input
              id="rename-world"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setRename(null)}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={!name.trim()}>
                Save name
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title={`Let ${remove.name} go?`} onClose={() => setRemove(null)}>
          <p>
            This deletes the world, its chronicle, and its discoveries from this device. You can
            export a backup in Settings first.
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setRemove(null)}>
              Keep world
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                onRemove(remove.id)
                setRemove(null)
              }}
            >
              <Trash2 size={16} />
              Delete world
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
