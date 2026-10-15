import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MICROVERSE could not render', error, info.componentStack)
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <p className="eyebrow">A MOMENTARY DISTURBANCE</p>
          <h1>Let’s find our orbit again.</h1>
          <p>
            The interface encountered a problem. Your previously saved worlds remain on this device.
          </p>
          <button
            className="button button-primary"
            onClick={() => {
              location.hash = '/universe'
              location.reload()
            }}
          >
            Reopen my universe
          </button>
        </main>
      )
    return this.props.children
  }
}
