import { useCallback, useEffect, useState } from 'react'
import { Compass, Globe2, Plus, Settings2, Sparkles, X } from 'lucide-react'
import { Home } from '../features/home/Home'
import { Creator } from '../features/creator/Creator'
import { Simulation } from '../features/simulation/Simulation'
import { Universe } from '../features/universe/Universe'
import { Discoveries } from '../features/discoveries/Discoveries'
import { Compare } from '../features/compare/Compare'
import { Settings } from '../features/settings/Settings'
import { BrandMark } from '../components/Icons'
import { ImportOriginDialog, ShareDialog } from '../components/ShareDialog'
import { useUniverse } from '../hooks/useUniverse'
import { usePreferences } from '../hooks/usePreferences'
import { usePWA } from '../hooks/usePWA'
import { BLUEPRINTS } from '../data/blueprints'
import type { WorldInput, WorldRecord } from '../types/world'

const readRoute = () => (location.hash.startsWith('#/') ? location.hash.slice(2) : 'home')
const STARS = Array.from({ length: 90 }, (_, i) => ({
  left: `${((i * 73.73 + 13) % 100).toFixed(2)}%`,
  top: `${((i * i * 17.41 + 7) % 100).toFixed(2)}%`,
  opacity: 0.12 + (i % 5) * 0.12,
  width: i % 9 === 0 ? 2 : 1,
  height: i % 9 === 0 ? 2 : 1,
}))

export default function App() {
  const universe = useUniverse()
  const { preferences, updatePreferences } = usePreferences()
  const pwa = usePWA()
  const [route, setRoute] = useState(readRoute)
  const [draft, setDraft] = useState<WorldInput>(BLUEPRINTS[0])
  const [creatorKey, setCreatorKey] = useState(0)
  const [autoRunId, setAutoRunId] = useState('')
  const [share, setShare] = useState<WorldRecord | null>(null)
  const [importOrigin, setImportOrigin] = useState(false)
  const [notice, setNotice] = useState('')

  const navigate = useCallback((destination: string) => {
    history.pushState(null, '', `#/${destination}`)
    setRoute(destination)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  useEffect(() => {
    const handlePop = () => {
      setRoute(readRoute())
      setAutoRunId('')
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion)
    window.dispatchEvent(new CustomEvent('microverse:motion'))
  }, [preferences.reducedMotion])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  const create = (input?: WorldInput) => {
    if (universe.worlds.length >= 100) {
      setNotice(
        'Your universe has reached 100 worlds. Export a backup and remove a world to create another.',
      )
      return
    }
    setDraft(input ?? { ...BLUEPRINTS[0], name: 'Aurelia', seed: crypto.randomUUID().slice(0, 12) })
    setCreatorKey((key) => key + 1)
    setAutoRunId('')
    navigate('create')
  }
  const openWorld = (id: string) => {
    setAutoRunId('')
    navigate(`world/${id}`)
  }
  const active = route.startsWith('world/')
    ? universe.worlds.find((world) => world.id === route.slice(6))
    : undefined
  const navItems = [
    { key: 'home', label: 'Overview', icon: Compass },
    { key: 'universe', label: 'My universe', icon: Globe2 },
    { key: 'discoveries', label: 'Discoveries', icon: Sparkles },
  ]
  const page = !universe.loaded ? (
    <main id="main" className="app-loading">
      <BrandMark />
      <p>Opening your universe…</p>
    </main>
  ) : route === 'home' ? (
    <Home onCreate={create} onExplore={() => navigate('universe')} quality={preferences.quality} />
  ) : route === 'create' ? (
    <Creator
      key={creatorKey}
      initial={draft}
      quality={preferences.quality}
      onBack={() => navigate('universe')}
      onBegin={(input) => {
        const world = universe.create(input)
        if (!world) return
        setAutoRunId(world.id)
        navigate(`world/${world.id}`)
      }}
    />
  ) : active ? (
    <Simulation
      key={active.id}
      world={active}
      quality={preferences.quality}
      autoRun={autoRunId === active.id}
      onTick={() => universe.tick(active.id)}
      onAct={(id) => universe.act(active.id, id)}
      onBack={() => navigate('universe')}
      onShare={() => setShare(active)}
      onDiscoveries={() => navigate('discoveries')}
      saveStatus={universe.saveStatus}
    />
  ) : route === 'discoveries' ? (
    <Discoveries worlds={universe.worlds} onCreate={create} onOpen={openWorld} />
  ) : route === 'compare' ? (
    <Compare worlds={universe.worlds} onBack={() => navigate('universe')} />
  ) : route === 'settings' ? (
    <Settings
      worlds={universe.worlds}
      quality={preferences.quality}
      reducedMotion={preferences.reducedMotion}
      onQuality={(quality) => updatePreferences({ quality })}
      onMotion={(reducedMotion) => updatePreferences({ reducedMotion })}
      onImport={universe.importRecords}
      pwa={pwa}
      saveStatus={universe.saveStatus}
    />
  ) : (
    <Universe
      worlds={universe.worlds}
      onCreate={create}
      onOpen={openWorld}
      onRename={universe.rename}
      onDuplicate={(id) => {
        if (universe.worlds.length >= 100) {
          setNotice('Your universe can hold up to 100 worlds.')
          return
        }
        universe.duplicate(id)
        setNotice('An independent copy of your world was created.')
      }}
      onRemove={universe.remove}
      onShare={setShare}
      onCompare={() => navigate('compare')}
      onImport={() => setImportOrigin(true)}
    />
  )

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          const main = document.getElementById('main')
          main?.setAttribute('tabindex', '-1')
          main?.focus()
        }}
      >
        Skip to content
      </a>
      <div className="cosmic-background" aria-hidden="true">
        <div className="nebula" />
        {STARS.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </div>
      <header className="site-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="MICROVERSE home">
          <BrandMark />
          <span>MICROVERSE</span>
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={
                route === item.key ||
                (item.key === 'universe' && (route.startsWith('world/') || route === 'compare'))
                  ? 'active'
                  : ''
              }
              aria-current={route === item.key ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="local-indicator">
            <span className="status-dot" />
            YOUR PERSONAL COSMOS
          </span>
          <button
            className={`icon-button settings-nav ${route === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            aria-label="Settings"
          >
            <Settings2 size={18} />
          </button>
          <button className="header-create" onClick={() => create()}>
            <Plus size={15} />
            <span>Create world</span>
          </button>
        </div>
      </header>
      {universe.error && (
        <div className="storage-alert" role="alert">
          <span>{universe.error}</span>
          {universe.saveStatus === 'error' && (
            <button className="button button-small" onClick={universe.retrySave}>
              Retry saving
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss storage message"
            onClick={universe.clearError}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {page}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          className={route === 'universe' || active ? 'active' : ''}
          onClick={() => navigate('universe')}
        >
          <Globe2 size={20} />
          <span>Universe</span>
        </button>
        <button className={route === 'create' ? 'active' : ''} onClick={() => create()}>
          <Plus size={22} />
          <span>Create</span>
        </button>
        <button
          className={route === 'discoveries' ? 'active' : ''}
          onClick={() => navigate('discoveries')}
        >
          <Sparkles size={20} />
          <span>Discoveries</span>
        </button>
        <button
          className={route === 'settings' ? 'active' : ''}
          onClick={() => navigate('settings')}
        >
          <Settings2 size={20} />
          <span>Settings</span>
        </button>
      </nav>
      {share && <ShareDialog world={share} onClose={() => setShare(null)} />}{' '}
      {importOrigin && (
        <ImportOriginDialog
          onClose={() => setImportOrigin(false)}
          onImport={(input) => {
            setImportOrigin(false)
            create(input)
          }}
        />
      )}{' '}
      {notice && (
        <div className="global-toast" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
