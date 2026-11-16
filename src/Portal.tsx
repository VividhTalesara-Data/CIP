import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, BookOpen, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Database, FileText, GitBranch, Globe2, Layers3, LogOut, MessageCircle, Network, Search, Settings2, ShieldCheck, Snowflake, Sparkles, Square, TriangleAlert, UserPlus, Wrench, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { demoPlanner } from './domain/planner.ts'
import { createDemoConnector } from './domain/fixtures.ts'
import type { DemoOptions } from './domain/fixtures.ts'
import { InvestigationEngine } from './domain/engine.ts'
import { flagshipQuestion, profiles } from './domain/profiles.ts'
import { sources } from './domain/sources.ts'
import type { Confidence, EvidenceContext, Investigation, Plan, ProfileId, SourceDefinition, SourceId, WorkflowNode } from './domain/types.ts'
import InvestigationCanvas from './components/InvestigationCanvas.tsx'
import ConversationHistory from './components/ConversationHistory.tsx'
import { AnalystAssignment, ReviewDetails, ReviewList } from './components/AnalystReview.tsx'
import { listReviewTickets, readReviewTicket, reviewLink } from './domain/reviews.ts'
import type { ReviewTicket } from './domain/reviews.ts'
import { authorizePlan, canUseSource } from './domain/access.ts'
import type { DemoUser } from './domain/access.ts'
import ReportTools from './components/ReportTools.tsx'
import type { SourceRegistration } from './domain/source-admin.ts'
import { loadConnections } from './domain/mcp-admin.ts'
import type { McpRegistration } from './domain/mcp-admin.ts'
import { describeSourceContext } from './domain/semantics.ts'

const sourceIcons: Record<string, LucideIcon> = {
  Snowflake, Splunk: AudioLines, ServiceNow: Layers3, Confluence: BookOpen, MCP: Wrench,
  'Newsline / My GPS': FileText, 'Market & news': Globe2, Sprinklr: MessageCircle,
}
const statusLabels: Record<WorkflowNode['status'], string> = {
  planned: 'Planned', retrieving: 'Retrieving', analyzing: 'Analyzing',
  complete: 'Complete', empty: 'No demo evidence', error: 'Unavailable', cancelled: 'Cancelled', unconfigured: 'Not connected',
}
const transition = { duration: 0.3 }
const EvidenceChart = lazy(() => import('./components/EvidenceChart.tsx'))
const SourceAdmin = lazy(() => import('./components/SourceAdmin.tsx'))
const AdminWorkspace = lazy(() => import('./components/AdminWorkspace.tsx'))
const McpAdmin = lazy(() => import('./components/McpAdmin.tsx'))

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
  const Icon = source ? Object.hasOwn(sourceIcons, source.platform) ? sourceIcons[source.platform] : Database : GitBranch
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

function FollowUpDock({ containerRef, profile, onSubmit, onError }: {
  containerRef: RefObject<HTMLDivElement | null>; profile: ProfileId
  onSubmit: (question: string) => void; onError: (message: string) => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let observer: IntersectionObserver
    const observe = () => {
      observer?.disconnect()
      observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
        rootMargin: `0px 0px -${Math.round(window.innerHeight / 2)}px 0px`,
      })
      observer.observe(container)
    }
    observe()
    window.addEventListener('resize', observe)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', observe)
    }
  }, [containerRef])
  return <div className={`followup-dock ${visible ? 'is-visible' : ''}`}>
    <Composer compact profile={profile} onSubmit={onSubmit} onError={onError} />
    <p><ShieldCheck size={11} /> Demo mode · Answers use synthetic evidence, not live financial data.</p>
  </div>
}

function ScriptedExcerpt({ excerpt }: { excerpt: NonNullable<EvidenceContext['excerpt']> }) {
  return <figure className="scripted-excerpt">
    <figcaption><MessageCircle size={14} />Scripted demo excerpt · {excerpt.label}</figcaption>
    <blockquote>{excerpt.text}</blockquote>
    <p>Illustrative only: not a real transcript or a representative sample. It does not establish frequency, sentiment or causation.</p>
  </figure>
}

function EvidenceView({ node, run }: { node: WorkflowNode; run: Investigation }) {
  const source = node.sourceId ? sources[node.sourceId] : undefined
  const item = run.evidence.find(evidence => evidence.id === node.evidenceId)
  return <>
    <div className="notice"><ShieldCheck size={17} /><span>{source?.handler === 'unconfigured' ? <><strong>Source not connected.</strong> This is a registered mapping only. No query or retrieval was executed; a server connector is required.</> : <><strong>Synthetic evidence.</strong> No enterprise system was queried. {node.reused ? 'Reused from the preceding compatible investigation.' : ''}</>}</span></div>
    {source && <div className="evidence-source"><span className="source-symbol"><SourceIcon source={source} size={23} /></span><div><strong>{source.platform}</strong><p>{source.name} · {statusLabels[node.status]}</p></div></div>}
    <p className="evidence-finding">{item?.finding ?? node.error ?? node.finding ?? 'This source is proposed. Evidence is not available yet.'}</p>
    {source?.semanticContext && <details className="agent-context-preview" open><summary>Data meaning and approved aggregation</summary><pre>{describeSourceContext(source, run.plan)}</pre></details>}
    {item?.context && <section className="evidence-context"><h3>{item.context.title}</h3><p>{item.context.summary}</p>{item.context.excerpt && <ScriptedExcerpt excerpt={item.context.excerpt} />}</section>}
    <dl className="evidence-details">
      <div><dt>Reporting window</dt><dd>{run.plan.period}</dd></div>
      <div><dt>Comparison</dt><dd>{run.plan.comparison}</dd></div>
      <div><dt>Context / filter</dt><dd>{run.plan.scope} · {run.plan.context.channels.join(', ') || 'All fixture channels'}</dd></div>
      {source?.connectionProperties && <div><dt>Dataset reference</dt><dd>{Object.entries(source.connectionProperties).map(([key, value]) => `${key}: ${value}`).join(' · ')}</dd></div>}
      <div><dt>Metric definition</dt><dd>{item?.definition ?? node.purpose}</dd></div>
      <div><dt>Unit of analysis</dt><dd>{item?.grain ?? 'To be confirmed'}</dd></div>
      {source && <><div><dt>{source.connectionKind === 'mcp' ? 'Declared tools' : 'Collections'}</dt><dd className="collection-list">{source.collections.map(collection => <code key={collection}>{collection}</code>)}</dd></div>{source.connectionKind !== 'mcp' && <><div><dt>Candidate join keys</dt><dd>{source.joinKeys.join(', ')}. Availability does not imply authorization or a valid join.</dd></div><div><dt>Time field / timezone</dt><dd>{source.timeField} / {source.semanticContext?.timezone ?? 'UTC'}</dd></div></>}</>}
      <div><dt>Freshness</dt><dd>{source?.handler === 'unconfigured' ? 'Not connected; freshness cannot be assessed.' : 'Synthetic snapshot through Nov 12, 2026; not live freshness.'}</dd></div>
    </dl>
    {item && <><h3 className="section-heading">Retrieved values</h3><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>{Object.entries(item.values).map(([key, value]) => <tr key={key}><td>{key.replace(/([A-Z])/g, ' $1')}</td><td>{value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div><p className="evidence-caveat"><CircleHelp size={15} />{item.caveat}</p></>}
    {node.dependencies.length > 0 && <><h3 className="section-heading">Depends on</h3><p className="muted">{node.dependencies.map(id => run.nodes.find(item => item.id === id)?.title ?? id).join(' · ')}</p></>}
  </>
}

function ConfidenceBadge({ confidence, prominent = false }: { confidence: Confidence; prominent?: boolean }) {
  const score = confidence.score === null ? 'Not assessed' : `${confidence.score}%`
  return <span className={`confidence-badge ${prominent ? 'prominent' : ''}`} title={confidence.explanation}>
    {prominent ? <><span className="confidence-label"><ShieldCheck size={17} />Demo confidence</span><strong className={`confidence-score ${confidence.score === null ? 'unassessed' : ''}`}>{score}</strong></> : <>Demo confidence · {score}</>}
  </span>
}

function EvidenceHighlights({ run, onEvidence }: { run: Investigation; onEvidence: (id: string) => void }) {
  const highlights = run.answer?.highlights
  if (!highlights?.length) return null
  return <section className="evidence-highlights" aria-labelledby="highlights-heading">
    <div className="section-header"><h3 id="highlights-heading">Evidence behind the answer</h3><span>{highlights.length} question-specific highlights</span></div>
    <p className="highlights-intro">Synthetic source summaries and illustrative excerpts · {run.plan.period}. Only evidence retrieved for this question is included.</p>
    <div className="highlight-grid">{highlights.map(item => <article className={`evidence-highlight ${item.category}`} key={item.evidenceId} data-highlight-source={item.sourceId}>
      <span className="highlight-category">{item.category === 'market' ? <Globe2 size={16} /> : item.category === 'engagement' ? <MessageCircle size={16} /> : <FileText size={16} />}{item.category === 'market' ? 'Historical market summary' : item.category === 'engagement' ? 'Engagement evidence' : 'Business context'}<span>DEMO</span></span>
      <h4>{item.title}</h4>
      <p className="highlight-observation">{item.observation}</p>
      <p className="highlight-summary">{item.summary}</p>
      {item.excerpt && <ScriptedExcerpt excerpt={item.excerpt} />}
      <p className="highlight-caveat">{item.caveat}</p>
      <ConfidenceBadge confidence={item.confidence} />
      <button className="highlight-source" onClick={() => onEvidence(item.evidenceId)} aria-label={`Inspect ${sources[item.sourceId].name} highlight evidence`}><SourceIcon source={sources[item.sourceId]} size={15} /><span>{sources[item.sourceId].name}<small>{sources[item.sourceId].platform} · Inspect source evidence</small></span><ArrowUpRight size={16} /></button>
    </article>)}</div>
  </section>
}

function Result({ run, user, onEvidence, onFollowUp, onAssign }: { run: Investigation; user: DemoUser; onEvidence: (id: string) => void; onFollowUp: (question: string) => void; onAssign: () => void }) {
  const answer = run.answer
  const reduced = useReducedMotion()
  const [chartMode, setChartMode] = useState<'comparison' | 'change'>('comparison')
  if (!answer) return null
  return <motion.section className="result" initial={{ opacity: 0, y: reduced ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={transition} aria-labelledby="answer-heading">
    <ReportTools run={run} user={user} />
    <div className="answer-kicker"><span className="answer-emblem"><Sparkles size={16} /></span> THE CONNECTED PICTURE <span className="demo-label">SYNTHETIC FINDINGS</span></div>
    {run.access.status === 'partial' && <div className="notice warning access-warning" role="status"><ShieldCheck size={18} /><span><strong>Limited-access answer.</strong> {run.access.excludedSourceCount} requested or discovered sources were excluded by your demo grants. {run.access.message}</span></div>}
    <h2 id="answer-heading" tabIndex={-1}>{answer.headline}</h2>
    <p className="answer-summary">{answer.summary}</p>
    <div className="analysis-decision-panel" role="group" aria-label="Analysis confidence">
      <div className="answer-confidence"><ConfidenceBadge confidence={answer.confidence} prominent /><p className="confidence-description">{answer.confidence.score === null ? 'No supported evidence-based estimate is available.' : 'Evidence-based demo estimate, not a probability of correctness.'}</p><details className="confidence-method"><summary>How demo confidence is scored</summary><p>{answer.confidence.explanation}</p><p>Scores are rounded evidence coverage multiplied by a heuristic ceiling: 90% for direct observations (including metrics and charts), 70% for associations and diagnostic summaries. Coverage counts selected sources, including discovered branches; missing, empty, failed or cancelled sources reduce it. Each item uses investigation-wide coverage, not an individual statistical estimate. Undiscovered sources and untested explanations remain unknown.</p><p>These are illustrative demo scores, not calibrated probabilities, statistical confidence intervals or proof of causation. No supported evidence means no score. Scripted excerpts are illustrative and do not increase the score.</p></details></div>
    </div>
    {answer.metrics.length > 0 && <div className="metric-grid">{answer.metrics.map(metric => <button key={metric.label} className="metric" onClick={() => onEvidence(metric.evidenceId)} aria-label={`Inspect ${metric.label} evidence`} aria-description={`Demo confidence: ${metric.confidence.score === null ? 'Not assessed' : `${metric.confidence.score}%`}. ${metric.confidence.explanation}`}><span>{metric.label}<ArrowUpRight size={13} /></span><strong>{metric.value}</strong><small>{metric.detail}</small><ConfidenceBadge confidence={metric.confidence} /></button>)}</div>}
    {answer.chart && <div className="chart-card">
      <div className="chart-heading"><div><span className="eyebrow">A CLOSER LOOK</span><h3>{answer.chart.title}</h3></div><button className="icon-button" onClick={() => onEvidence(answer.chart!.evidenceId)} aria-label="Inspect chart evidence"><ArrowUpRight size={18} /></button></div>
      <ConfidenceBadge confidence={answer.chart.confidence} />
      <div className="chart-view-controls" role="group" aria-label="Comparison chart view"><button aria-pressed={chartMode === 'comparison'} onClick={() => setChartMode('comparison')}>Compare periods</button><button aria-pressed={chartMode === 'change'} onClick={() => setChartMode('change')}>Change vs baseline</button></div>
      {chartMode === 'comparison' ? <div className="chart-legend"><span><i className="legend-baseline" />Comparison</span><span><i className="legend-current" />Selected period</span></div> : <p className="chart-mode-note">Selected period minus comparison · {answer.chart.unit === '%' ? 'Percentage points, not percentage growth' : answer.chart.unit}. Direction does not imply a good or bad outcome.</p>}
      <div className="chart" role="img" aria-label={`${answer.chart.title}. Exact values are in the accessible data table below.`}>
        <Suspense fallback={<p className="muted" role="status">Loading chart. Exact values are available below.</p>}><EvidenceChart rows={answer.chart.rows} unit={answer.chart.unit} mode={chartMode} /></Suspense>
      </div>
      <details className="chart-data"><summary>View exact values and comparison dates</summary><p>{run.plan.period} vs. {run.plan.comparison} · Unit: {answer.chart.unit}</p><table className="data-table"><thead><tr><th>Group</th><th>Comparison</th><th>Selected period</th><th>Change{answer.chart.unit === '%' ? ' (pp)' : ''}</th></tr></thead><tbody>{answer.chart.rows.map(row => <tr key={row.label}><td>{row.label}</td><td>{row.baseline.toLocaleString('en-US')}</td><td>{row.current.toLocaleString('en-US')}</td><td>{(row.current - row.baseline).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></details>
    </div>}
    {answer.findings.length > 0 && <section className="findings"><div className="section-header"><h3>What the evidence tells us</h3><span>{answer.findings.length} connected findings</span></div>{answer.findings.slice(0, 3).map((finding, i) => <button className="finding" key={finding.evidenceIds.join()} onClick={() => onEvidence(finding.evidenceIds[0])}><span className="finding-number">{String(i + 1).padStart(2, '0')}</span><span><span className="finding-labels"><span className={`strength ${finding.strength.toLowerCase()}`}>{finding.strength}</span><ConfidenceBadge confidence={finding.confidence} /></span><span className="finding-text">{finding.text}</span></span><ArrowUpRight size={16} /></button>)}{answer.findings.length > 3 && <details className="more-findings"><summary>View {answer.findings.length - 3} more findings</summary>{answer.findings.slice(3).map(finding => <button className="finding" key={finding.evidenceIds.join()} onClick={() => onEvidence(finding.evidenceIds[0])}><span><span className="finding-labels"><span className={`strength ${finding.strength.toLowerCase()}`}>{finding.strength}</span><ConfidenceBadge confidence={finding.confidence} /></span><span className="finding-text">{finding.text}</span></span><ArrowUpRight size={16} /></button>)}</details>}</section>}
    <EvidenceHighlights run={run} onEvidence={onEvidence} />
    {answer.recommendations.length > 0 && <section className="next-actions"><div className="section-header"><h3>A thoughtful next step</h3><span>Recommendations, not executed actions</span></div><ol>{answer.recommendations.map(item => <li key={item}>{item}</li>)}</ol></section>}
    <details className="limitations" open={run.status === 'partial' || run.plan.scenario === 'unsupported'}><summary><CircleHelp size={16} /> Scope, freshness & limitations <ChevronDown size={14} /></summary><ul>{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>Evidence snapshot: November 12, 2026 · UTC · Synthetic data</p></details>
    <div className="analyst-handoff" role="group" aria-label="Analyst review"><span className="review-eyebrow"><UserPlus size={17} />ANALYST REVIEW</span><h3>Unsure about the conclusion?</h3><p>Ask an analyst to validate it. The question, findings, sources and saved analysis travel with your review.</p><button onClick={onAssign}><UserPlus size={19} />Assign to analyst<ArrowRight size={18} /></button><small>Creates a local demo story. No real Jira issue or notification.</small></div>
    <div className="followup-suggestions"><span className="eyebrow">KEEP EXPLORING</span><div>{answer.followUps.map(question => <button key={question} onClick={() => onFollowUp(question)}>{question}<ArrowRight size={14} /></button>)}</div></div>
  </motion.section>
}

function Portal({ user, onSignOut }: { user: DemoUser; onSignOut: () => void }) {
  const [registryState, setRegistryState] = useState(() => loadConnections(() => window.localStorage))
  const [profile, setProfile] = useState<ProfileId>(user.profile)
  const [adminPreview, setAdminPreview] = useState(false)
  const [sourceProvider, setSourceProvider] = useState('custom')
  const [editingSource, setEditingSource] = useState<SourceRegistration>()
  const [mcpTemplate, setMcpTemplate] = useState('custom')
  const [editingMcp, setEditingMcp] = useState<McpRegistration>()
  const [run, setRun] = useState<Investigation>()
  const [history, setHistory] = useState<Investigation[]>([])
  const [error, setError] = useState(registryState.error)
  const [modal, setModal] = useState<'demo' | 'sources' | 'scope' | 'assign' | 'reviews' | 'review' | 'review-created' | 'analysis' | 'review-error' | 'access' | 'source-admin' | 'mcp-admin' | null>(null)
  const [savedReview, setSavedReview] = useState<ReviewTicket>()
  const [reviewTickets, setReviewTickets] = useState<ReviewTicket[]>([])
  const [reviewError, setReviewError] = useState('')
  const [selectedNode, setSelectedNode] = useState<WorkflowNode>()
  const [activeRunId, setActiveRunId] = useState<string>()
  const [demoOptions, setDemoOptions] = useState<DemoOptions>({ latency: true })
  const engine = useRef<InvestigationEngine | undefined>(undefined)
  const questionRef = useRef<HTMLHeadingElement>(null)
  const turnRef = useRef<HTMLHeadingElement>(null)
  const answerWorkspaceRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const running = run?.status === 'running'
  const visibleSources = Object.values(sources).filter(source => canUseSource(user, source.id))
  const suggestedQuestions = profiles[profile].questions.filter(item => authorizePlan(demoPlanner.plan(item.question, profile), user).status !== 'denied')
  const showAdmin = Boolean(user.isAdmin && !adminPreview)

  useEffect(() => () => engine.current?.cancel(), [])
  useEffect(() => {
    const openLinkedReview = () => {
      const params = new URLSearchParams(window.location.hash.slice(1))
      if (!params.has('analysis') && !params.has('review')) {
        setModal(current => current && ['review', 'review-created', 'analysis', 'review-error'].includes(current) ? null : current)
        return
      }
      try {
        const ticket = readReviewTicket(window.localStorage, params.get('analysis') ?? params.get('review') ?? '', user.id)
        setSavedReview(ticket)
        setReviewError('')
        setModal(params.has('analysis') ? 'analysis' : 'review')
      } catch (cause) {
        setReviewError(`Could not open the saved demo review. ${cause instanceof Error ? cause.message : 'Check browser storage permissions and try again.'}`)
        setModal('review-error')
      }
    }
    openLinkedReview()
    window.addEventListener('hashchange', openLinkedReview)
    return () => window.removeEventListener('hashchange', openLinkedReview)
  }, [user.id])

  const closeReview = () => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    if (params.has('analysis') || params.has('review')) window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setModal(null)
  }
  const openReviewList = () => {
    setReviewError('')
    try {
      setReviewTickets(listReviewTickets(window.localStorage, user.id))
    } catch (cause) {
      setReviewError(`Could not load saved demo reviews. ${cause instanceof Error ? cause.message : 'Check browser storage permissions and try again.'}`)
    }
    setModal('reviews')
  }

  const launch = (plan: Plan, previous?: Investigation, options = demoOptions) => {
      if (registryState.error) { setError('Investigations are paused because the source registry could not load. Reload the registry and resolve the reported error before continuing.'); return }
      setError('')
      setSelectedNode(undefined)
      if (user.isAdmin) setAdminPreview(true)
      if (run && !previous) setHistory(items => [...items.filter(item => item.id !== run.id), run])
      const nextEngine = new InvestigationEngine(plan, state => { if (engine.current === nextEngine) setRun(state) }, previous, user)
      engine.current = nextEngine
      setActiveRunId(nextEngine.state.id)
      setRun(nextEngine.state)
      void nextEngine.execute(createDemoConnector(options)).catch(cause => setError(cause instanceof Error ? cause.message : 'Investigation could not finish. Please start a new question.'))
      requestAnimationFrame(() => {
        const heading = previous ? turnRef.current : questionRef.current
        heading?.focus()
        heading?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
      })
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
        <button className="brand" onClick={() => { reset(); setAdminPreview(false) }} aria-label="Clarity home"><Logo /><span>clarity<span className="brand-period">.</span></span><span className="brand-divider" /><span className="product-label">Customer intelligence</span></button>
        <nav className="header-actions" aria-label="Workspace"><button className="text-button reviews-button" aria-label="Analyst reviews" onClick={openReviewList}><ClipboardList size={14} /><span>Analyst reviews</span></button><button className="text-button sources-button" onClick={() => setModal('sources')}><Database size={14} />Source library</button><button className="demo-pill" onClick={() => setModal('demo')}><span className="tiny-dot" />Demo workspace<ChevronDown size={12} /></button><button className="signout-button" aria-label="Sign out" onClick={onSignOut}><LogOut size={15} /><span>Sign out</span></button></nav>
      </header>
      <div className="access-bar"><span className="signed-in-user"><ShieldCheck size={15} /><strong>Signed in as {user.name}</strong><small>Demo session</small></span><span>{user.role}</span><button onClick={() => setModal('access')}>View my access</button>{user.isAdmin && adminPreview && <button onClick={() => { reset(); setAdminPreview(false) }}>Back to admin workspace</button>}</div>
      {registryState.error && <div className="source-registry-error"><p className="form-error" role="alert">{registryState.error} Investigations are paused; the registry has not been replaced with an empty configuration.</p><button onClick={() => {
        const loaded = loadConnections(() => window.localStorage)
        setRegistryState(loaded)
        setError(loaded.error)
      }}>Reload source registry</button></div>}
      <main id="main-content" className={showAdmin ? 'admin-main' : run ? 'workspace-main' : 'landing-main'}>
        {showAdmin ? <Suspense fallback={<p className="muted" role="status">Loading administration workspace...</p>}><AdminWorkspace registrations={registryState.registrations} servers={registryState.servers} onData={providerId => { setSourceProvider(providerId); setEditingSource(undefined); setModal('source-admin') }} onContext={source => { setSourceProvider(source.providerId ?? 'custom'); setEditingSource(source); setModal('source-admin') }} onMcp={(templateId, server) => { setMcpTemplate(templateId); setEditingMcp(server); setModal('mcp-admin') }} onPreview={() => setAdminPreview(true)} /></Suspense> : !run ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="landing">
          <div className="profile-control"><span>YOUR PERSPECTIVE</span><label className="profile-select"><span className="sr-only">Business profile</span><select value={profile} onChange={event => setProfile(event.target.value as ProfileId)}>{Object.entries(profiles).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><ChevronDown size={13} /></label></div>
          <div className="hero-symbol"><Logo /><span className="hero-orbit" /></div>
          <h1>Clarity starts<br />with a <em>question.</em></h1>
          <p className="hero-description">{profiles[profile].description}<br className="mobile-break" /> Connect the signals. Understand the story.</p>
          <div className="question-area"><Composer profile={profile} onSubmit={question => submit(question)} onError={setError} />{error && <p className="form-error" role="alert">{error}</p>}</div>
          <section className="suggestions" aria-label="Personalized questions">
            <div className="suggestions-heading"><span>CURATED FOR {profiles[profile].short.toUpperCase()}</span><span>Start somewhere meaningful <ArrowDown size={11} /></span></div>
            <AnimatePresence mode="wait"><motion.div key={`${profile}:${user.id}`} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="suggestion-grid">{suggestedQuestions.slice(0, 4).map((item, index) => <button key={item.question} className="suggestion-card" onClick={() => submit(item.question)}><span className="suggestion-category">{index === 0 ? <GitBranch size={13} /> : index === 1 ? <Layers3 size={13} /> : index === 2 ? <MessageCircle size={13} /> : <Network size={13} />}{item.category}</span><span className="suggestion-title">{item.title}<ArrowUpRight size={16} /></span></button>)}</motion.div></AnimatePresence>
            {suggestedQuestions[4] && <button className="extra-suggestion" onClick={() => submit(suggestedQuestions[4].question)}>{suggestedQuestions[4].title}<ArrowRight size={13} /></button>}
            {!suggestedQuestions.length && <p className="muted">No suggested questions are permitted for this perspective. Choose another perspective within your demo access.</p>}
          </section>
          <div className="landing-note"><ShieldCheck size={14} /><span>Synthetic data. Simulated connections. A real look at what is possible.</span></div>
          {history.length > 0 && <details className="recent-investigations"><summary>Recent in this session <span>{history.length}</span></summary>{history.slice().reverse().map(item => <button key={item.id} onClick={() => { engine.current = undefined; setProfile(item.plan.context.profile); setRun(item) }}><Search size={13} /><span>{item.plan.question}</span><ArrowUpRight size={13} /></button>)}</details>}
        </motion.div> : <div className="workspace">
          <div className="workspace-breadcrumb"><button onClick={reset}><ArrowLeft size={14} /> New question</button><ChevronRight size={12} /><span>{profiles[profile].short}</span><span className="session-badge">DEMO INVESTIGATION</span></div>
          <h1 className="investigation-question" ref={questionRef} tabIndex={-1}>{run.turns[0]?.plan.question ?? run.plan.question}</h1>
          <div className="scope-row"><span><span className="tiny-dot" />{run.plan.scope}</span><span>{run.plan.period}</span><button onClick={() => setModal('scope')}><Settings2 size={12} /> Scope & assumptions</button>{run.turn > 1 && <span className="context-reused">{run.nodes.some(node => node.reused) ? 'Context & evidence reused' : 'Same conversation · New evidence scope'}</span>}</div>
          {run.status !== 'denied' && <InvestigationCanvas run={run} onInspect={setSelectedNode} onCancel={() => engine.current?.cancel()}
            onRetry={activeRunId === run.id ? retry : undefined}
            onReplay={() => { if (!running) launch(run.plan, undefined, { ...demoOptions, latency: true }) }} />}
          <div className="answer-workspace" ref={answerWorkspaceRef}>
            <ConversationHistory turns={run.turns} />
            {run.turn > 1 && <div className="current-turn"><span>QUESTION {run.turn} · SAME CONVERSATION</span><h2 ref={turnRef} tabIndex={-1}>{run.plan.question}</h2>{run.status !== 'denied' && <button onClick={() => document.querySelector('.investigation-theater')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })}><Network size={14} />View updated canvas</button>}</div>}
            {run.status === 'cancelled' && <div className="cancelled-state"><Square size={20} /><h2>Stopped, not lost.</h2><p>Your completed evidence is still available in the investigation. Retry missing sources to continue, or ask a new question.</p></div>}
            {run.status === 'denied' && <section className="access-denied"><div className="notice warning" role="alert"><ShieldCheck size={22} /><div><h2>Access denied for this question</h2><p>{run.access.message} No source calls were made.</p></div></div><p className="muted">You can continue with a permitted question. This is a simulated policy decision, not production authentication.</p><Composer compact profile={profile} onSubmit={question => submit(question, true)} onError={setError} /></section>}
            <Result run={run} user={user} onEvidence={inspectEvidence} onFollowUp={question => submit(question, true)} onAssign={() => setModal('assign')} />
            {error && <p className="form-error" role="alert">{error}</p>}
            {!running && run.status !== 'denied' && <FollowUpDock containerRef={answerWorkspaceRef} profile={profile} onSubmit={question => submit(question, true)} onError={setError} />}
          </div>
        </div>}
      </main>
      <footer className="app-footer"><span>Made for the questions that matter.</span><button onClick={() => setModal('demo')}><CircleHelp size={13} />About this demo</button><span className="footer-right"><span className="tiny-dot" />No live connections</span></footer>
    </div>
    {modal === 'demo' && <Modal title="A working vision. Not live data." onClose={() => setModal(null)}>
      <div className="notice"><ShieldCheck size={17} /><span>This independent prototype is not affiliated with Fidelity Investments. All accounts, events, sources and findings are synthetic.</span></div>
      <p className="modal-intro">Explore how a question becomes a connected investigation. The same execution state powers every source card, evidence panel and answer.</p>
      <div className="demo-setting"><div><strong>Simulated connector latency</strong><p>Watch dummy tools connect, pull data and reconcile evidence over several seconds per source. Turn off for instant retrieval. Replay demo always enables these simulated stages.</p></div><input type="checkbox" aria-label="Simulated connector latency" checked={demoOptions.latency} onChange={event => setDemoOptions(options => ({ ...options, latency: event.target.checked }))} /></div>
      <label className="demo-failure"><span>Test a source failure on the next investigation</span><select value={demoOptions.failSource ?? ''} onChange={event => setDemoOptions(options => ({ ...options, failSource: event.target.value ? event.target.value as SourceId : undefined }))}><option value="">All available demo sources respond</option>{visibleSources.map(source => <option key={source.id} value={source.id}>{source.platform} · {source.name}</option>)}</select></label>
      <p className="muted small-copy">Retry restores the failed simulated connector and preserves successful results. Settings apply to new investigations. A failed source is exercised only when the question selects it.</p>
      <h3 className="section-heading">Six evidence-backed demo scenarios</h3><p className="muted">Retirement conversion, Roth openings, HSA openings, market volatility, retirement retention and rollover contacts. Other questions receive proposed source plans, not fabricated answers.</p>
      <div className="modal-actions"><button className="primary-button" disabled={running} onClick={() => { setModal(null); submit(flagshipQuestion) }}>Explore the flagship investigation<ArrowRight size={15} /></button></div>
    </Modal>}
    {modal === 'sources' && <Modal title="One question. The right sources." onClose={() => setModal(null)} wide>
      <div className="notice"><Database size={17} /><span>{visibleSources.length} mappings are permitted for this demo user. These are configurable placeholders; connections are simulated.</span></div>
      <div className="registry-grid">{visibleSources.map(source => <details className="registry-card" key={source.id}><summary><span className="source-symbol"><SourceIcon source={source} /></span><span><strong>{source.name}</strong><small>{source.platform} · {source.handler === 'unconfigured' ? 'Not connected' : 'Demo fixture'}</small></span><ChevronDown size={13} /></summary><p>{source.description}</p><div className="collection-list">{source.collections.map(table => <code key={table}>{table}</code>)}</div><p className="small-copy">Join keys: {source.joinKeys.join(', ')}<br />Time field: {source.timeField}<br />Access: {source.access}<br />Handler: {source.handler}<br />Connection key: {source.connectionKey}</p></details>)}</div>
    </Modal>}
    {modal === 'scope' && run && <Modal title="The boundaries of this question." onClose={() => setModal(null)}>
      <dl className="evidence-details"><div><dt>Question</dt><dd>{run.plan.question}</dd></div><div><dt>Intent / metrics</dt><dd>{run.plan.context.intent} · {run.plan.context.metrics.join(', ')}</dd></div><div><dt>Business context</dt><dd>{run.plan.scope}</dd></div><div><dt>Selected period</dt><dd>{run.plan.period}</dd></div><div><dt>Comparison</dt><dd>{run.plan.comparison}</dd></div></dl><h3 className="section-heading">Explicit assumptions</h3><ul className="assumptions-list">{run.plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul>{run.plan.limitation && <div className="notice warning"><TriangleAlert size={17} />{run.plan.limitation}</div>}<p className="small-copy muted">Ask a follow-up to request a different scope. If that scope has no demo evidence, the portal will say so rather than relabel existing results.</p>
    </Modal>}
    {modal === 'assign' && run && <Modal title="Assign an analyst review" onClose={closeReview}><AnalystAssignment run={run} onCreated={ticket => {
      setSavedReview(ticket)
      window.history.pushState(null, '', reviewLink(ticket.id, 'review', window.location.href))
      setModal('review-created')
    }} /></Modal>}
    {modal === 'reviews' && <Modal title="Analyst reviews" onClose={closeReview}>{reviewError ? <p className="form-error" role="alert">{reviewError}</p> : <ReviewList tickets={reviewTickets} />}</Modal>}
    {modal === 'review-error' && <Modal title="Demo review unavailable" onClose={closeReview}><p className="form-error" role="alert">{reviewError}</p></Modal>}
    {modal === 'source-admin' && user.isAdmin && <Modal title="Data source administration" onClose={() => setModal(null)} wide><Suspense fallback={<p className="muted" role="status">Loading source administration...</p>}><SourceAdmin key={editingSource?.id ?? sourceProvider} providerId={sourceProvider} initialSource={editingSource} user={user} registrations={registryState.registrations} onSaved={registrations => { setRegistryState(current => ({ ...current, registrations, error: '' })); setError('') }} /></Suspense></Modal>}
    {modal === 'mcp-admin' && user.isAdmin && <Modal title="MCP server configuration" onClose={() => setModal(null)} wide><Suspense fallback={<p className="muted" role="status">Loading MCP configuration...</p>}><McpAdmin key={editingMcp?.id ?? mcpTemplate} templateId={mcpTemplate} initialServer={editingMcp} user={user} onSaved={servers => { setRegistryState(current => ({ ...current, servers, error: '' })); setError('') }} /></Suspense></Modal>}
    {modal === 'access' && <Modal title="Your demo access" onClose={() => setModal(null)}>
      <div className="notice warning"><ShieldCheck size={18} /><span><strong>Demonstration, not a security boundary.</strong> Public dummy credentials are not production authentication. All fixtures ship in the browser; real data requires server-side authorization.</span></div>
      <h3 className="section-heading">{user.name}</h3><p className="muted">{user.role}</p>
      <dl className="evidence-details"><div><dt>Permitted scenarios</dt><dd>{user.scenarios.join(', ') || 'None'}</dd></div><div><dt>Permitted products</dt><dd>{user.products.join(', ') || 'None'}</dd></div><div><dt>Permitted sources</dt><dd>{visibleSources.map(source => source.name).join(', ') || 'None'}</dd></div></dl>
      <p className="muted small-copy">Out-of-scope questions are denied before retrieval. Mixed-access questions use only permitted sources and show a limited-access warning. The same check applies to evidence-discovered sources and follow-ups.</p>
      <p className="muted small-copy">Signing out clears the active conversation and cached results. Saved review lists and links are limited to the creating demo user. The business perspective selector changes suggestions, not permissions.</p>
    </Modal>}
    {(modal === 'review-created' || modal === 'review' || modal === 'analysis') && savedReview && <Modal key={`${modal}:${savedReview.id}`} title={modal === 'review-created' ? 'Demo review story created' : modal === 'analysis' ? 'Saved analysis' : `Demo story ${savedReview.key}`} onClose={closeReview} wide><ReviewDetails ticket={savedReview} created={modal === 'review-created'} analysisOnly={modal === 'analysis'} /></Modal>}
    {selectedNode && run && <Modal title={selectedNode.title} onClose={() => setSelectedNode(undefined)}><EvidenceView node={run.nodes.find(node => node.id === selectedNode.id) ?? selectedNode} run={run} /></Modal>}
  </MotionConfig>
}

export default Portal
