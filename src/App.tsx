import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, BookOpen, ChevronDown, ChevronRight, CircleHelp, Database, FileText, GitBranch, Globe2, Layers3, MessageCircle, Network, Search, Settings2, ShieldCheck, Snowflake, Sparkles, Square, TriangleAlert, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { demoPlanner } from './domain/planner.ts'
import { createDemoConnector } from './domain/fixtures.ts'
import type { DemoOptions } from './domain/fixtures.ts'
import { InvestigationEngine } from './domain/engine.ts'
import { flagshipQuestion, profiles } from './domain/profiles.ts'
import { sources } from './domain/sources.ts'
import type { Investigation, Plan, ProfileId, SourceDefinition, SourceId, WorkflowNode } from './domain/types.ts'
import './App.css'
import InvestigationCanvas from './components/InvestigationCanvas.tsx'

const sourceIcons: Record<string, LucideIcon> = {
  Snowflake, Splunk: AudioLines, ServiceNow: Layers3, Confluence: BookOpen,
  'Newsline / My GPS': FileText, 'Market & news': Globe2, Sprinklr: MessageCircle,
}
const statusLabels: Record<WorkflowNode['status'], string> = {
  planned: 'Planned', retrieving: 'Retrieving', analyzing: 'Analyzing',
  complete: 'Complete', empty: 'No demo evidence', error: 'Unavailable', cancelled: 'Cancelled',
}
const transition = { duration: 0.3 }
const EvidenceChart = lazy(() => import('./components/EvidenceChart.tsx'))

function Logo({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true"><span /><span /><span /><span /></span>
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby="modal-heading" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-header"><div><span className="eyebrow">CLARITY / DEMO WORKSPACE</span><h2 id="modal-heading">{title}</h2></div><button autoFocus className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
    <div className="modal-content">{children}</div>
  </dialog>
}

function SourceIcon({ source, size = 18 }: { source?: SourceDefinition; size?: number }) {
  const Icon = source ? sourceIcons[source.platform] ?? Database : GitBranch
  return <Icon size={size} aria-hidden="true" />
}

function Composer({ onSubmit, disabled = false, compact = false, profile, onError }: { onSubmit: (question: string) => void; disabled?: boolean; compact?: boolean; profile: ProfileId; onError: (message: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => {
    if (!value.trim()) { onError('Write a question or choose one of the suggestions.'); return }
    if (disabled) return
    onSubmit(value.trim())
    setValue('')
  }
  return <form className={`composer ${compact ? 'compact' : ''}`} onSubmit={event => { event.preventDefault(); submit() }}>
    <label className="sr-only" htmlFor={compact ? 'followup-question' : 'main-question'}>{compact ? 'Ask a follow-up question' : 'Ask a question'}</label>
    <div className="composer-input">
      {!compact && <Search className="composer-search" size={22} aria-hidden="true" />}
      <textarea id={compact ? 'followup-question' : 'main-question'} value={value} onChange={event => { setValue(event.target.value); onError('') }} rows={compact ? 1 : 2}
        maxLength={2000} disabled={disabled} placeholder={compact ? 'Follow the thread. Ask a follow-up...' : 'Ask about your customers, business performance, or engagement.'}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }} />
      {compact && <button className="submit-button" type="submit" disabled={disabled || !value.trim()} aria-label="Submit follow-up"><ArrowUp size={19} /></button>}
    </div>
    {!compact && <div className="composer-bottom">
      <span className="context-tag"><span className="tiny-dot" />{profiles[profile].short} context</span>
      <div className="composer-actions"><span className="keyboard-hint">Enter to ask <span>↵</span></span><button className="submit-button" type="submit" disabled={disabled || !value.trim()} aria-label="Submit question"><ArrowUp size={20} /></button></div>
    </div>}
  </form>
}

function EvidenceView({ node, run }: { node: WorkflowNode; run: Investigation }) {
  const source = node.sourceId ? sources[node.sourceId] : undefined
  const item = run.evidence.find(evidence => evidence.id === node.evidenceId)
  return <>
    <div className="notice"><ShieldCheck size={17} /><span><strong>Synthetic evidence.</strong> No enterprise system was queried. {node.reused ? 'Reused from the preceding compatible investigation.' : ''}</span></div>
    {source && <div className="evidence-source"><span className="source-symbol"><SourceIcon source={source} size={23} /></span><div><strong>{source.platform}</strong><p>{source.name} · {statusLabels[node.status]}</p></div></div>}
    <p className="evidence-finding">{item?.finding ?? node.error ?? node.finding ?? 'This source is proposed. Evidence is not available yet.'}</p>
    <dl className="evidence-details">
      <div><dt>Reporting window</dt><dd>{run.plan.period}</dd></div>
      <div><dt>Comparison</dt><dd>{run.plan.comparison}</dd></div>
      <div><dt>Context / filter</dt><dd>{run.plan.scope} · {run.plan.context.channels.join(', ') || 'All fixture channels'}</dd></div>
      <div><dt>Metric definition</dt><dd>{item?.definition ?? node.purpose}</dd></div>
      <div><dt>Unit of analysis</dt><dd>{item?.grain ?? 'To be confirmed'}</dd></div>
      {source && <><div><dt>Collections</dt><dd className="collection-list">{source.collections.map(collection => <code key={collection}>{collection}</code>)}</dd></div><div><dt>Candidate join keys</dt><dd>{source.joinKeys.join(', ')}. Availability does not imply authorization or a valid join.</dd></div><div><dt>Time field / timezone</dt><dd>{source.timeField} / UTC</dd></div></>}
      <div><dt>Freshness</dt><dd>Synthetic snapshot through Nov 12, 2026; not live freshness.</dd></div>
    </dl>
    {item && <><h3 className="section-heading">Retrieved values</h3><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>{Object.entries(item.values).map(([key, value]) => <tr key={key}><td>{key.replace(/([A-Z])/g, ' $1')}</td><td>{value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div><p className="evidence-caveat"><CircleHelp size={15} />{item.caveat}</p></>}
    {node.dependencies.length > 0 && <><h3 className="section-heading">Depends on</h3><p className="muted">{node.dependencies.map(id => run.nodes.find(item => item.id === id)?.title ?? id).join(' · ')}</p></>}
  </>
}

function Result({ run, onEvidence, onFollowUp }: { run: Investigation; onEvidence: (id: string) => void; onFollowUp: (question: string) => void }) {
  const answer = run.answer
  const reduced = useReducedMotion()
  if (!answer) return null
  return <motion.section className="result" initial={{ opacity: 0, y: reduced ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={transition} aria-labelledby="answer-heading">
    <div className="answer-kicker"><span className="answer-emblem"><Sparkles size={16} /></span> THE CONNECTED PICTURE <span className="demo-label">SYNTHETIC FINDINGS</span></div>
    <h2 id="answer-heading" tabIndex={-1}>{answer.headline}</h2>
    <p className="answer-summary">{answer.summary}</p>
    {answer.metrics.length > 0 && <div className="metric-grid">{answer.metrics.map(metric => <button key={metric.label} className="metric" onClick={() => onEvidence(metric.evidenceId)} aria-label={`Inspect ${metric.label} evidence`}><span>{metric.label}<ArrowUpRight size={13} /></span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}</div>}
    {answer.chart && <div className="chart-card">
      <div className="chart-heading"><div><span className="eyebrow">A CLOSER LOOK</span><h3>{answer.chart.title}</h3></div><button className="icon-button" onClick={() => onEvidence(answer.chart!.evidenceId)} aria-label="Inspect chart evidence"><ArrowUpRight size={18} /></button></div>
      <div className="chart-legend"><span><i className="legend-baseline" />Comparison</span><span><i className="legend-current" />Selected period</span></div>
      <div className="chart" role="img" aria-label={`${answer.chart.title}. Exact values are in the accessible data table below.`}>
        <Suspense fallback={<p className="muted" role="status">Loading chart. Exact values are available below.</p>}><EvidenceChart rows={answer.chart.rows} unit={answer.chart.unit} /></Suspense>
      </div>
      <details className="chart-data"><summary>View exact values and comparison dates</summary><p>{run.plan.period} vs. {run.plan.comparison} · Unit: {answer.chart.unit}</p><table className="data-table"><thead><tr><th>Group</th><th>Comparison</th><th>Selected period</th></tr></thead><tbody>{answer.chart.rows.map(row => <tr key={row.label}><td>{row.label}</td><td>{row.baseline.toLocaleString('en-US')}</td><td>{row.current.toLocaleString('en-US')}</td></tr>)}</tbody></table></details>
    </div>}
    {answer.findings.length > 0 && <section className="findings"><div className="section-header"><h3>What the evidence tells us</h3><span>{answer.findings.length} connected findings</span></div>{answer.findings.slice(0, 3).map((finding, i) => <button className="finding" key={finding.evidenceIds.join()} onClick={() => onEvidence(finding.evidenceIds[0])}><span className="finding-number">{String(i + 1).padStart(2, '0')}</span><span><span className={`strength ${finding.strength.toLowerCase()}`}>{finding.strength}</span><span className="finding-text">{finding.text}</span></span><ArrowUpRight size={16} /></button>)}{answer.findings.length > 3 && <details className="more-findings"><summary>View {answer.findings.length - 3} more findings</summary>{answer.findings.slice(3).map(finding => <button className="finding" key={finding.evidenceIds.join()} onClick={() => onEvidence(finding.evidenceIds[0])}><span className={`strength ${finding.strength.toLowerCase()}`}>{finding.strength}</span><span className="finding-text">{finding.text}</span><ArrowUpRight size={16} /></button>)}</details>}</section>}
    {answer.recommendations.length > 0 && <section className="next-actions"><div className="section-header"><h3>A thoughtful next step</h3><span>Recommendations, not executed actions</span></div><ol>{answer.recommendations.map(item => <li key={item}>{item}</li>)}</ol></section>}
    <details className="limitations" open={run.status === 'partial' || run.plan.scenario === 'unsupported'}><summary><CircleHelp size={16} /> Scope, freshness & limitations <ChevronDown size={14} /></summary><ul>{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>Evidence snapshot: November 12, 2026 · UTC · Synthetic data</p></details>
    <div className="followup-suggestions"><span className="eyebrow">KEEP EXPLORING</span><div>{answer.followUps.map(question => <button key={question} onClick={() => onFollowUp(question)}>{question}<ArrowRight size={14} /></button>)}</div></div>
  </motion.section>
}

function App() {
  const [profile, setProfile] = useState<ProfileId>('retirement')
  const [run, setRun] = useState<Investigation>()
  const [history, setHistory] = useState<Investigation[]>([])
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'demo' | 'sources' | 'scope' | null>(null)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode>()
  const [activeRunId, setActiveRunId] = useState<string>()
  const [demoOptions, setDemoOptions] = useState<DemoOptions>({ latency: true })
  const engine = useRef<InvestigationEngine | undefined>(undefined)
  const questionRef = useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotion()
  const running = run?.status === 'running'

  useEffect(() => () => engine.current?.cancel(), [])

  const launch = (plan: Plan, previous?: Investigation, options = demoOptions) => {
      setError('')
      setSelectedNode(undefined)
      if (run) setHistory(items => [...items.filter(item => item.id !== run.id), run])
      const nextEngine = new InvestigationEngine(plan, state => { if (engine.current === nextEngine) setRun(state) }, previous)
      engine.current = nextEngine
      setActiveRunId(nextEngine.state.id)
      setRun(nextEngine.state)
      void nextEngine.execute(createDemoConnector(options)).catch(cause => setError(cause instanceof Error ? cause.message : 'Investigation could not finish. Please start a new question.'))
      requestAnimationFrame(() => { questionRef.current?.focus(); questionRef.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }) })
  }
  const submit = (question: string, followUp = false) => {
    if (running) return
    try {
      const previous = followUp ? run : undefined
      launch(demoPlanner.plan(question, profile, previous?.plan), previous)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not interpret this question.')
    }
  }
  const reset = () => {
    engine.current?.cancel()
    if (run) setHistory(items => [...items.filter(item => item.id !== run.id), engine.current?.state ?? run])
    engine.current = undefined
    setActiveRunId(undefined)
    setRun(undefined)
    setSelectedNode(undefined)
    setError('')
  }
  const inspectEvidence = (id: string) => {
    const node = run?.nodes.find(item => item.evidenceId === id)
    if (node) setSelectedNode(node)
  }
  const retry = () => {
    setDemoOptions(options => ({ ...options, failSource: undefined }))
    void engine.current?.retry(createDemoConnector({ ...demoOptions, failSource: undefined })).catch(cause => setError(cause instanceof Error ? cause.message : 'Retry failed. Please start a new investigation.'))
  }
  return <MotionConfig reducedMotion="user">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={reset} aria-label="Clarity home"><Logo /><span>clarity<span className="brand-period">.</span></span><span className="brand-divider" /><span className="product-label">Customer intelligence</span></button>
        <nav className="header-actions" aria-label="Workspace"><button className="text-button sources-button" onClick={() => setModal('sources')}><Database size={14} />Source library</button><button className="demo-pill" onClick={() => setModal('demo')}><span className="tiny-dot" />Demo workspace<ChevronDown size={12} /></button><span className="avatar" aria-label="Demo user">JD</span></nav>
      </header>
      <main id="main-content" className={run ? 'workspace-main' : 'landing-main'}>
        {!run ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="landing">
          <div className="profile-control"><span>YOUR PERSPECTIVE</span><label className="profile-select"><span className="sr-only">Business profile</span><select value={profile} onChange={event => setProfile(event.target.value as ProfileId)}>{Object.entries(profiles).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><ChevronDown size={13} /></label></div>
          <div className="hero-symbol"><Logo /><span className="hero-orbit" /></div>
          <h1>Clarity starts<br />with a <em>question.</em></h1>
          <p className="hero-description">{profiles[profile].description}<br className="mobile-break" /> Connect the signals. Understand the story.</p>
          <div className="question-area"><Composer profile={profile} onSubmit={question => submit(question)} onError={setError} />{error && <p className="form-error" role="alert">{error}</p>}</div>
          <section className="suggestions" aria-label="Personalized questions">
            <div className="suggestions-heading"><span>CURATED FOR {profiles[profile].short.toUpperCase()}</span><span>Start somewhere meaningful <ArrowDown size={11} /></span></div>
            <AnimatePresence mode="wait"><motion.div key={profile} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="suggestion-grid">{profiles[profile].questions.slice(0, 4).map((item, index) => <button key={item.question} className="suggestion-card" onClick={() => submit(item.question)}><span className="suggestion-category">{index === 0 ? <GitBranch size={13} /> : index === 1 ? <Layers3 size={13} /> : index === 2 ? <MessageCircle size={13} /> : <Network size={13} />}{item.category}</span><span className="suggestion-title">{item.title}<ArrowUpRight size={16} /></span></button>)}</motion.div></AnimatePresence>
            {profiles[profile].questions[4] && <button className="extra-suggestion" onClick={() => submit(profiles[profile].questions[4].question)}>{profiles[profile].questions[4].title}<ArrowRight size={13} /></button>}
          </section>
          <div className="landing-note"><ShieldCheck size={14} /><span>Synthetic data. Simulated connections. A real look at what is possible.</span></div>
          {history.length > 0 && <details className="recent-investigations"><summary>Recent in this session <span>{history.length}</span></summary>{history.slice().reverse().map(item => <button key={item.id} onClick={() => { engine.current = undefined; setProfile(item.plan.context.profile); setRun(item) }}><Search size={13} /><span>{item.plan.question}</span><ArrowUpRight size={13} /></button>)}</details>}
        </motion.div> : <div className="workspace">
          <div className="workspace-breadcrumb"><button onClick={reset}><ArrowLeft size={14} /> New question</button><ChevronRight size={12} /><span>{profiles[profile].short}</span><span className="session-badge">DEMO INVESTIGATION</span></div>
          <h1 className="investigation-question" ref={questionRef} tabIndex={-1}>{run.plan.question}</h1>
          <div className="scope-row"><span><span className="tiny-dot" />{run.plan.scope}</span><span>{run.plan.period}</span><button onClick={() => setModal('scope')}><Settings2 size={12} /> Scope & assumptions</button>{history.length > 0 && <span className="context-reused">{run.nodes.some(node => node.reused) ? 'Context & evidence reused' : 'Context-aware workspace'}</span>}</div>
          <InvestigationCanvas run={run} onInspect={setSelectedNode} onCancel={() => engine.current?.cancel()}
            onRetry={activeRunId === run.id ? retry : undefined}
            onReplay={() => { if (!running) launch(run.plan, undefined, { ...demoOptions, latency: true }) }} />
          {run.status === 'cancelled' && <div className="cancelled-state"><Square size={20} /><h2>Stopped, not lost.</h2><p>Your completed evidence is still available in the investigation. Retry missing sources to continue, or ask a new question.</p></div>}
          <Result run={run} onEvidence={inspectEvidence} onFollowUp={question => submit(question, true)} />
          {error && <p className="form-error" role="alert">{error}</p>}
          {!running && <div className="followup-dock"><Composer compact profile={profile} onSubmit={question => submit(question, true)} onError={setError} /><p><ShieldCheck size={11} /> Demo mode · Answers use synthetic evidence, not live financial data.</p></div>}
        </div>}
      </main>
      <footer className="app-footer"><span>Made for the questions that matter.</span><button onClick={() => setModal('demo')}><CircleHelp size={13} />About this demo</button><span className="footer-right"><span className="tiny-dot" />No live connections</span></footer>
    </div>
    {modal === 'demo' && <Modal title="A working vision. Not live data." onClose={() => setModal(null)}>
      <div className="notice"><ShieldCheck size={17} /><span>This independent prototype is not affiliated with Fidelity Investments. All accounts, events, sources and findings are synthetic.</span></div>
      <p className="modal-intro">Explore how a question becomes a connected investigation. The same execution state powers every source card, evidence panel and answer.</p>
      <div className="demo-setting"><div><strong>Simulated connector latency</strong><p>Watch dummy tools connect, pull data and reconcile evidence over several seconds per source. Turn off for instant retrieval. Replay demo always enables these simulated stages.</p></div><input type="checkbox" aria-label="Simulated connector latency" checked={demoOptions.latency} onChange={event => setDemoOptions(options => ({ ...options, latency: event.target.checked }))} /></div>
      <label className="demo-failure"><span>Test a source failure on the next investigation</span><select value={demoOptions.failSource ?? ''} onChange={event => setDemoOptions(options => ({ ...options, failSource: event.target.value ? event.target.value as SourceId : undefined }))}><option value="">All available demo sources respond</option>{Object.values(sources).map(source => <option key={source.id} value={source.id}>{source.platform} · {source.name}</option>)}</select></label>
      <p className="muted small-copy">Retry restores the failed simulated connector and preserves successful results. Settings apply to new investigations. A failed source is exercised only when the question selects it.</p>
      <h3 className="section-heading">Six evidence-backed demo scenarios</h3><p className="muted">Retirement conversion, Roth openings, HSA openings, market volatility, retirement retention and rollover contacts. Other questions receive proposed source plans, not fabricated answers.</p>
      <div className="modal-actions"><button className="primary-button" disabled={running} onClick={() => { setModal(null); submit(flagshipQuestion) }}>Explore the flagship investigation<ArrowRight size={15} /></button></div>
    </Modal>}
    {modal === 'sources' && <Modal title="One question. The right sources." onClose={() => setModal(null)} wide>
      <div className="notice"><Database size={17} /><span>All {Object.keys(sources).length} mappings are configurable placeholders. Connections are simulated; no credentials or internal endpoints are stored here.</span></div>
      <div className="registry-grid">{Object.values(sources).map(source => <details className="registry-card" key={source.id}><summary><span className="source-symbol"><SourceIcon source={source} /></span><span><strong>{source.name}</strong><small>{source.platform}</small></span><ChevronDown size={13} /></summary><p>{source.description}</p><div className="collection-list">{source.collections.map(table => <code key={table}>{table}</code>)}</div><p className="small-copy">Join keys: {source.joinKeys.join(', ')}<br />Time field: {source.timeField}<br />Access: {source.access}<br />Handler: {source.handler}<br />Connection key: {source.connectionKey}</p></details>)}</div>
    </Modal>}
    {modal === 'scope' && run && <Modal title="The boundaries of this question." onClose={() => setModal(null)}>
      <dl className="evidence-details"><div><dt>Question</dt><dd>{run.plan.question}</dd></div><div><dt>Intent / metrics</dt><dd>{run.plan.context.intent} · {run.plan.context.metrics.join(', ')}</dd></div><div><dt>Business context</dt><dd>{run.plan.scope}</dd></div><div><dt>Selected period</dt><dd>{run.plan.period}</dd></div><div><dt>Comparison</dt><dd>{run.plan.comparison}</dd></div></dl><h3 className="section-heading">Explicit assumptions</h3><ul className="assumptions-list">{run.plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul>{run.plan.limitation && <div className="notice warning"><TriangleAlert size={17} />{run.plan.limitation}</div>}<p className="small-copy muted">Ask a follow-up to request a different scope. If that scope has no demo evidence, the portal will say so rather than relabel existing results.</p>
    </Modal>}
    {selectedNode && run && <Modal title={selectedNode.title} onClose={() => setSelectedNode(undefined)}><EvidenceView node={run.nodes.find(node => node.id === selectedNode.id) ?? selectedNode} run={run} /></Modal>}
  </MotionConfig>
}

export default App
