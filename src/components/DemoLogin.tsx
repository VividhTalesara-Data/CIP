import { useState } from 'react'
import { ArrowRight, Database, KeyRound, Network, ShieldCheck } from 'lucide-react'
import { demoAccounts, demoPassword } from '../domain/session.ts'

export default function DemoLogin({ onLogin, initialError }: { onLogin: (username: string, password: string) => void; initialError: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  return <div className="login-shell">
    <header className="login-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><strong>clarity.</strong><span>Customer intelligence</span></header>
    <main className="login-layout">
      <section className="login-intro"><span className="login-eyebrow">THE RIGHT CONTEXT. THE RIGHT ACCESS.</span><h1>One workspace.<br />A clearer picture.</h1><p>Connect business questions to the evidence that matters, with a workspace tailored to your role.</p><div className="login-benefits"><div><Database size={22} /><span><strong>Connect your data</strong><small>Databases, cloud services and MCP configuration</small></span></div><div><Network size={22} /><span><strong>Teach the business context</strong><small>Field meaning, metric definitions and aggregation rules</small></span></div><div><ShieldCheck size={22} /><span><strong>Explore with the right access</strong><small>Personalized questions and permission-aware evidence</small></span></div></div></section>
      <section className="login-card" aria-labelledby="login-heading"><span className="login-card-icon"><KeyRound size={23} /></span><h2 id="login-heading">Sign in to the demo</h2><p>Admins configure the workspace. Other users continue to the existing intelligence portal.</p>
        <form onSubmit={event => {
          event.preventDefault()
          setError('')
          try { onLogin(username, password) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Demo sign-in could not finish. Please try again.') }
        }}>
          <label>Username<input autoComplete="username" required maxLength={80} value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. admin or executive" /></label>
          <label>Password<input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)} placeholder="Demo password only" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit">Sign in<ArrowRight size={18} /></button>
        </form>
        <details className="demo-credentials" open><summary>Sample demo credentials</summary><p>All sample accounts use <code>{demoPassword}</code>. Select an account to fill the form.</p><div>{demoAccounts.map(account => <button key={account.user.id} type="button" aria-label={`Use ${account.username} credentials`} onClick={() => { setUsername(account.username); setPassword(demoPassword); setError('') }}><strong>{account.username}</strong><span>{account.user.isAdmin ? 'Administrator workspace' : account.user.name}</span></button>)}</div></details>
        <p className="login-disclaimer"><ShieldCheck size={14} />Public dummy credentials only. This is not production authentication; never enter a real password.</p>
      </section>
    </main>
  </div>
}
