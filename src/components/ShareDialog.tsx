import { useState } from 'react'
import { Check, Copy, ArrowRight } from 'lucide-react'
import { Modal } from './Modal'
import { decodeWorld, encodeWorld } from '../persistence'
import type { WorldInput, WorldRecord } from '../types/world'

export function ShareDialog({ world, onClose }: { world: WorldRecord; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const code = encodeWorld({ ...world.initial, seed: world.seed, name: world.name })
  return (
    <Modal title="Every beginning can be shared." onClose={onClose}>
      <p>
        This origin code recreates <strong>{world.name}</strong> with the same seed and starting
        conditions. Its next story is up to whoever plays.
      </p>
      <label className="field-label" htmlFor="origin-code">
        Origin code
      </label>
      <textarea
        id="origin-code"
        className="code-field"
        readOnly
        value={code}
        onFocus={(event) => event.target.select()}
      />
      <button
        className="button button-primary full-width"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setFailed(false)
          } catch {
            setFailed(true)
          }
        }}
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}{' '}
        {copied ? 'Origin copied' : 'Copy origin code'}
      </button>
      <p className="settings-footnote" role="status">
        {failed
          ? 'Select the code above and copy it manually.'
          : 'To share the current state and its history, export a JSON backup in Settings.'}
      </p>
    </Modal>
  )
}
export function ImportOriginDialog({
  onImport,
  onClose,
}: {
  onImport: (input: WorldInput) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal title="A beginning from somewhere else." onClose={onClose}>
      <p>Paste a MICROVERSE origin code to preview its planet before beginning a new story.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          try {
            onImport(decodeWorld(code.trim()))
          } catch (error) {
            setError(error instanceof Error ? error.message : 'This origin code is not valid.')
          }
        }}
      >
        <label className="field-label" htmlFor="import-code">
          Origin code
        </label>
        <textarea
          id="import-code"
          className="code-field"
          maxLength={8000}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="MX1.…"
          required
        />
        <p className="field-error" role="alert">
          {error}
        </p>
        <button type="submit" className="button button-primary full-width">
          Preview world
          <ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  )
}
