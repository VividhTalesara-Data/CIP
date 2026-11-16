import { lazy, Suspense, useState } from 'react'
import DemoLogin from './components/DemoLogin.tsx'
import { loadDemoSession, signInDemo, signOutDemo } from './domain/session.ts'
import './App.css'

const Portal = lazy(() => import('./Portal.tsx'))

export default function App() {
  const [session, setSession] = useState(() => loadDemoSession(() => window.localStorage))
  const signOut = () => {
    let error = ''
    try { signOutDemo(window.localStorage) } catch (cause) {
      error = `Signed out of this page, but the saved demo session could not be removed. ${cause instanceof Error ? cause.message : 'Clear browser storage before using a shared device.'}`
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setSession({ user: null, error })
  }
  if (!session.user) return <DemoLogin initialError={session.error} onLogin={(username, password) => {
    const user = signInDemo(window.localStorage, username, password)
    setSession({ user, error: '' })
  }} />
  return <Suspense fallback={<main className="portal-loading"><p role="status">Opening your workspace...</p></main>}><Portal key={session.user.id} user={session.user} onSignOut={signOut} /></Suspense>
}
