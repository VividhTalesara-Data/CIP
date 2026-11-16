import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowRight, ArrowUpRight, AudioLines, BookOpen, Check, ChevronDown, CircleHelp, Database, Expand, FileText, GitBranch, Globe2, List, LoaderCircle, Maximize2, MessageCircle, Minus, Network, Pause, Play, Plus, Radar, RotateCcw, ShieldCheck, Snowflake, Sparkles, Square, TriangleAlert, Workflow, Wrench } from 'lucide-react'
import { sources } from '../domain/sources.ts'
import { connectionPath, layoutInvestigation, SOURCE_HEIGHT, SOURCE_WIDTH, sourcePort } from '../domain/canvas-layout.ts'
import type { Point } from '../domain/canvas-layout.ts'
import type { Investigation, SourceDefinition, WorkflowNode } from '../domain/types.ts'
import './InvestigationCanvas.css'

const icons = { Snowflake, Splunk: AudioLines, ServiceNow: Workflow, Confluence: BookOpen, 'Newsline / My GPS': FileText, 'Market & news': Globe2, Sprinklr: MessageCircle, MCP: Wrench }
const colors: Record<string, string> = {
  Snowflake: '#7ac9f5', Splunk: '#f4b77d', ServiceNow: '#9edaaf', Confluence: '#acafff',
  'Newsline / My GPS': '#dfb7f4', 'Market & news': '#f3d48a', Sprinklr: '#f3a5bb',
}
const statusLabels: Record<WorkflowNode['status'], string> = {
  planned: 'Planned', retrieving: 'Retrieving', analyzing: 'Analyzing',
  complete: 'Complete', empty: 'No demo evidence', error: 'Unavailable', cancelled: 'Cancelled', unconfigured: 'Not connected',
}

type FlightStyle = CSSProperties & { '--source-color'?: string; '--float-delay'?: string; '--flight-delay'?: string }
const sourceColor = (platform: string) => Object.hasOwn(colors, platform) ? colors[platform] : '#92debf'

function ToolIcon({ source, size = 21 }: { source: SourceDefinition; size?: number }) {
  const Icon = Object.hasOwn(icons, source.platform) ? icons[source.platform as keyof typeof icons] : Database
  return <Icon size={size} aria-hidden="true" />
}

function FloatingSource({ node, index, position, origin, run, onInspect, still, focused }: {
  node: WorkflowNode; index: number; position: Point; origin: Point
  run: Investigation; onInspect: (node: WorkflowNode) => void; still: boolean; focused: boolean
}) {
  if (!node.sourceId) return null
  const source = sources[node.sourceId]
  const active = ['retrieving', 'analyzing'].includes(node.status)
  const evidence = run.evidence.find(item => item.id === node.evidenceId)
  const style: FlightStyle = {
    '--source-color': sourceColor(source.platform),
    '--float-delay': `${-(index % 5) * 1.1}s`,
  }
  return <motion.div
    className="source-flight"
    data-source-id={node.sourceId}
    data-status={node.status}
    data-focused={focused}
    style={style}
    initial={still ? false : { x: origin.x - SOURCE_WIDTH / 2, y: origin.y - SOURCE_HEIGHT / 2, opacity: 0, scale: 0.4 }}
    animate={{ x: position.x - SOURCE_WIDTH / 2, y: position.y - SOURCE_HEIGHT / 2, opacity: 1, scale: 1 }}
    transition={still ? { duration: 0 } : { type: 'spring', stiffness: 65, damping: 17, mass: 0.9 }}
  >
    <button className={`floating-source ${node.status}`} onClick={() => onInspect(node)} aria-label={`${node.title}: ${statusLabels[node.status]}. Inspect evidence`}>
      <span className="source-port source-port-left" aria-hidden="true" /><span className="source-port source-port-right" aria-hidden="true" />
      <span className="floating-source-header"><span className="floating-tool-icon"><ToolIcon source={source} /></span><span className="floating-source-identity"><strong>{source.platform}</strong><span>{node.title}</span></span><span className={`floating-source-status ${node.status}`}>
        {active ? <LoaderCircle size={14} className="flight-spinner" /> : node.status === 'complete' ? <Check size={14} /> : node.status === 'error' ? <TriangleAlert size={14} /> : node.status === 'empty' || node.status === 'unconfigured' ? <CircleHelp size={14} /> : <span className="flight-status-dot" />}
      </span></span>
      <span className="floating-collection"><Database size={11} /><code>{source.collections[0]}</code>{source.collections.length > 1 && <span>+{source.collections.length - 1}</span>}</span>
      <span className="floating-purpose">{node.error ?? evidence?.title ?? node.finding ?? node.purpose}</span>
      <span className="floating-source-footer"><span>{source.handler === 'unconfigured' ? 'Not connected' : node.reused ? 'Evidence reused' : node.activity ?? statusLabels[node.status]}</span><span>{run.plan.scenario === 'unsupported' ? 'PROPOSED' : 'DEMO'} <ArrowUpRight size={10} /></span></span>
      {active && <span className="source-scanner" aria-hidden="true" />}
    </button>
  </motion.div>
}

function FlowPacket({ path, label, type, delay = 0, color }: { path: string; label?: string; type: 'query' | 'data' | 'arrival'; delay?: number; color: string }) {
  const style: FlightStyle = { offsetPath: `path("${path}")`, '--flight-delay': `${delay}s`, '--source-color': color }
  return <span aria-hidden="true" className={`flow-packet ${type}`} style={style} data-packet-kind={type}>
    {label ? <><span className="packet-light" /><span className="packet-label">{label}</span><ArrowRight size={10} /></> : <span className="packet-comet" />}
  </span>
}

function IntelligenceCore({ run, center, onInspect, onAnswer }: {
  run: Investigation; center: Point; onInspect: (node: WorkflowNode) => void; onAnswer: () => void
}) {
  const running = run.status === 'running'
  const supported = run.plan.scenario !== 'unsupported'
  const analysis = run.nodes.find(node => node.id === 'reconcile')
  const synthesis = run.nodes.find(node => node.id === 'answer')
  return <>
    <div className={`intelligence-core ${running ? 'processing' : ''}`} style={{ left: center.x, top: center.y }}>
      <div className="core-orb" aria-hidden="true">
        <div className="orb-halo" />
        <div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-ring ring-three" />
        <div className="orb-sphere"><Network size={41} strokeWidth={1} /><span className="orb-specular" /></div>
        <span className="orb-satellite satellite-one" /><span className="orb-satellite satellite-two" />
      </div>
      <span className="core-eyebrow">CLARITY INTELLIGENCE</span>
      <strong className="core-title">{!supported ? 'Planning the path' : run.status === 'cancelled' ? 'Investigation stopped' : running ? 'Connecting the dots' : run.status === 'partial' ? 'A partial picture' : 'The picture is clear'}</strong>
      <span className="core-subtitle">{running ? 'Following signals across your data' : supported ? `${run.evidence.length} synthetic findings connected` : 'Proposed sources. No retrieved evidence.'}</span>
      <div className="core-phases">
        <span className={run.evidence.length ? 'phase-done' : 'phase-current'}><Radar size={11} />Retrieve</span><ArrowRight size={10} />
        <button onClick={() => analysis && onInspect(analysis)} className={analysis?.status === 'complete' ? 'phase-done' : ''}><GitBranch size={11} />Connect</button><ArrowRight size={10} />
        <button onClick={() => synthesis && onInspect(synthesis)} className={synthesis?.status === 'complete' ? 'phase-done' : ''}><Sparkles size={11} />Explain</button>
      </div>
    </div>
    <div className={`insight-destination ${run.answer ? 'ready' : ''}`} style={{ left: center.x, top: center.y + 222 }}>
      <div className={`insight-link ${running ? 'active' : ''}`} aria-hidden="true"><span /><ArrowDown size={12} /></div>
      <button onClick={onAnswer} disabled={!run.answer}>
        <span className="insight-icon"><Sparkles size={18} /></span>
        <span><strong>{run.answer ? supported ? 'Your connected insight' : 'Proposed investigation' : 'Building your insight'}</strong><small>{run.answer ? 'Explore the answer & evidence' : 'Evidence arrives here, not assumptions'}</small></span>
        {run.answer ? <ArrowDown size={15} /> : <span className="insight-waiting"><i /><i /><i /></span>}
      </button>
    </div>
  </>
}

interface Props {
  run: Investigation
  onInspect: (node: WorkflowNode) => void
  onCancel: () => void
  onRetry?: () => void
  onReplay: () => void
}

export default function InvestigationCanvas({ run, onInspect, onCancel, onRetry, onReplay }: Props) {
  const reduced = Boolean(useReducedMotion())
  const [paused, setPaused] = useState(false)
  const [listView, setListView] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [frame, setFrame] = useState({ width: 1200, height: 680 })
  const viewport = useRef<HTMLDivElement>(null)
  const theater = useRef<HTMLElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const sourceNodes = run.nodes.filter(node => node.kind === 'source')
  const layout = layoutInvestigation(sourceNodes)
  const fit = Math.min(frame.width / layout.width, frame.height / layout.height)
  const scale = fit * zoom
  const running = run.status === 'running'
  const supported = run.plan.scenario !== 'unsupported'
  const still = reduced || paused || run.status === 'cancelled'
  const active = sourceNodes.filter(node => ['retrieving', 'analyzing'].includes(node.status))
  const complete = sourceNodes.filter(node => node.status === 'complete')
  const focusIds = new Set(run.answer?.findings.flatMap(finding => finding.evidenceIds))
  const reused = sourceNodes.filter(node => node.reused).length
  const recent = run.events.filter(event => event.status === 'complete' && sourceNodes.some(node => node.id === event.nodeId)).at(-1)
  const statusText = !supported ? 'A proposed path through your data' : run.status === 'cancelled' ? 'Investigation paused' : running ? 'Watch your question become an insight' : run.status === 'partial' ? 'Investigation complete with gaps' : 'The investigation, connected'

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      setFrame({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    element.scrollLeft = Math.max(0, (layout.width * scale - frame.width) / 2)
    element.scrollTop = Math.max(0, (layout.height * scale - frame.height) / 2)
  }, [scale, frame.width, frame.height, layout.width, layout.height])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpanded(false)
        expandButton.current?.focus()
      }
      if (event.key === 'Tab') {
        const elements = Array.from(theater.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"], summary') ?? []).filter(element => element.getClientRects().length > 0)
        const first = elements[0]
        const last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [expanded])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
    drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
    event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y)
  }
  const showAnswer = () => {
    setExpanded(false)
    requestAnimationFrame(() => {
      const heading = document.getElementById('answer-heading')
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
    })
  }
  return <section ref={theater} className={`investigation-theater ${expanded ? 'expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label="Animated investigation workspace" data-motion={still ? 'paused' : 'running'} data-run-status={run.status} data-thread-id={run.id} data-turn={run.turn}>
    <div className="theater-heading">
      <div className="theater-heading-icon"><Network size={21} /></div>
      <div className="theater-heading-copy"><span className="theater-eyebrow">THE INVESTIGATION / IN MOTION</span><h2>{statusText}</h2><p className="theater-question">{run.plan.question}</p></div>
      <span className="theater-demo-badge"><span />{running ? 'SIMULATED LIVE ACTIVITY' : 'SIMULATED CONNECTIONS'}</span>
    </div>
    {run.turn > 1 && <div className="canvas-continuation" role="status"><strong>Question {run.turn}: {run.plan.question}</strong><span>{reused} sources reused · {sourceNodes.length - reused} other sources in scope. Highlighted sources support this answer; prior answers remain below. Reused evidence does not trigger new connector calls.</span></div>}
    <div className="theater-toolbar">
      <div className="theater-view-switch" role="group" aria-label="Investigation view"><button aria-pressed={!listView} onClick={() => setListView(false)}><Network size={14} />Canvas</button><button aria-pressed={listView} onClick={() => setListView(true)}><List size={14} />Source list</button></div>
      <span className="theater-counts"><strong>{sourceNodes.length}</strong> sources <span /> <strong>{complete.length}</strong> evidence received {running && <><span /><strong>{active.length}</strong> active</>}</span>
      <div className="theater-controls">
        <button onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume animation' : 'Pause animation'} disabled={reduced} title={reduced ? 'Reduced motion is enabled in your system preferences' : 'Pause visual motion; retrieval continues'}>{paused || reduced ? <Play size={14} /> : <Pause size={14} />}<span>{paused || reduced ? 'Motion off' : 'Pause motion'}</span></button>
        {running ? <button className="theater-cancel" onClick={onCancel}><Square size={11} /><span>Cancel</span></button>
          : onRetry && (run.status === 'cancelled' || run.nodes.some(node => node.status === 'error')) ? <button onClick={onRetry}><RotateCcw size={14} /><span>Retry missing sources</span></button>
            : supported && <button onClick={() => { setPaused(false); setListView(false); setZoom(1); onReplay() }} title="Run the same simulated investigation again, with connector latency"><RotateCcw size={14} /><span>Replay demo</span></button>}
        <button ref={expandButton} onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Exit expanded canvas' : 'Expand canvas'} aria-pressed={expanded}><Expand size={15} /></button>
      </div>
    </div>
    <div className="theater-map-area" hidden={listView}>
      <div className="theater-atmosphere" aria-hidden="true"><span /><span /></div>
      <div className="theater-map-caption"><span><span className={`theater-live-dot ${running ? 'active' : ''}`} />{!supported ? 'PROPOSED CONNECTIONS ONLY' : running ? 'SIMULATED TOOL EXECUTION' : run.status === 'cancelled' ? 'RETRIEVAL STOPPED' : 'EVIDENCE MAP'}</span><span>{paused ? 'Visuals paused. Retrieval continues.' : 'Connections appear as the question unfolds.'}</span></div>
      <div className="theater-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Source connection canvas. Zoom in to inspect, drag or use arrow keys to pan. A source list is also available."
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <div className="theater-world-boundary" style={{ width: Math.max(frame.width, layout.width * scale), height: Math.max(frame.height, layout.height * scale) }}>
          <div className="theater-world" style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, left: Math.max(0, (frame.width - layout.width * scale) / 2), top: Math.max(0, (frame.height - layout.height * scale) / 2) }}>
            <div className="core-orbit-track" style={{ left: layout.center.x, top: layout.center.y }} aria-hidden="true" />
            <svg className="connection-layer" width={layout.width} height={layout.height} aria-hidden="true">
              <defs><filter id="connection-glow"><feGaussianBlur stdDeviation="3" /></filter></defs>
              {sourceNodes.map((node, index) => {
                const point = layout.positions[node.id]
                const source = node.sourceId ? sources[node.sourceId] : undefined
                const color = sourceColor(source?.platform ?? '')
                const port = sourcePort(point, layout.center)
                const hub = { x: layout.center.x + (point.x < layout.center.x ? -94 : 94), y: layout.center.y - 20 }
                const path = connectionPath(port, hub, (index % 3 - 1) * 34)
                const working = ['retrieving', 'analyzing'].includes(node.status)
                return <g key={`${run.id}-${node.id}`} className={`connection-group ${node.status} ${run.turn > 1 && focusIds.has(node.evidenceId ?? '') ? 'focused' : ''}`} style={{ '--source-color': color } as FlightStyle}>
                  <motion.path className="connection-track" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} d={path} transition={{ duration: still ? 0 : 0.8 }} />
                  {(working || node.status === 'complete') && <path className={`connection-current ${working ? 'flowing' : ''}`} d={path} />}
                  <circle cx={port.x} cy={port.y} r="3" fill={color} /><circle cx={hub.x} cy={hub.y} r="3" fill={color} />
                </g>
              })}
              {sourceNodes.flatMap(node => node.dependencies.filter(id => layout.positions[id]).map(parentId => {
                const parent = layout.positions[parentId]
                const child = layout.positions[node.id]
                const path = connectionPath(sourcePort(parent, child), sourcePort(child, parent), 70)
                return <motion.path key={`${run.id}-${parentId}-${node.id}`} className={`discovery-connection ${node.status}`} data-from={parentId} data-to={node.id} d={path}
                  initial={still ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.55 }} transition={{ duration: still ? 0 : 1.1 }} />
              }))}
            </svg>
            {!reduced && supported && run.status !== 'cancelled' && <div className="packet-layer" aria-hidden="true">
              {sourceNodes.map((node, index) => {
                if (!node.sourceId) return null
                const source = sources[node.sourceId]
                const color = sourceColor(source.platform)
                const point = layout.positions[node.id]
                const port = sourcePort(point, layout.center)
                const hub = { x: layout.center.x + (point.x < layout.center.x ? -94 : 94), y: layout.center.y - 20 }
                const path = connectionPath(port, hub, (index % 3 - 1) * 34)
                const working = ['retrieving', 'analyzing'].includes(node.status)
                const parent = node.dependencies.map(id => layout.positions[id]).find(Boolean)
                const queryPath = parent ? connectionPath(sourcePort(parent, point), sourcePort(point, parent), 70) : connectionPath(hub, port, 30)
                return <span key={`${run.id}-${node.id}`} data-stream-source={node.id}>
                  {working && <><FlowPacket type="query" path={queryPath} color={color} /><FlowPacket type="data" path={path} color={color} label={node.activity === 'Connecting simulated tool' ? 'Opening connection' : source.collections[0]} delay={0.4 + (index % 3) * 0.3} /><FlowPacket type="query" path={path} color={color} delay={-1.1} /></>}
                  {node.status === 'complete' && <FlowPacket key={`${node.id}-${run.events.filter(event => event.nodeId === node.id && event.status === 'complete').at(-1)?.id}`} type="arrival" path={path} color={color} label={node.reused ? 'Evidence reused' : run.evidence.find(item => item.id === node.evidenceId)?.title ?? 'Evidence received'} />}
                </span>
              })}
            </div>}
            <IntelligenceCore run={run} center={layout.center} onInspect={onInspect} onAnswer={showAnswer} />
            <AnimatePresence>{sourceNodes.map((node, index) => <FloatingSource key={`${run.id}-${node.id}`} node={node} index={index} position={layout.positions[node.id]} origin={node.dependencies.map(id => layout.positions[id]).find(Boolean) ?? layout.center} run={run} onInspect={onInspect} still={still} focused={run.turn > 1 && focusIds.has(node.evidenceId ?? '')} />)}</AnimatePresence>
          </div>
        </div>
      </div>
      <div className="theater-map-footer"><div className="connection-legend"><span><i className="legend-query" />Tool call</span><span><i className="legend-transfer" />Data flowing</span><span><i className="legend-discovery" />Discovered connection</span></div>
        <div className="canvas-zoom"><button onClick={() => setZoom(value => Math.max(0.7, value - 0.25))} disabled={zoom <= 0.7} aria-label="Zoom out"><Minus size={13} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(3, value + 0.25))} disabled={zoom >= 3} aria-label="Zoom in"><Plus size={13} /></button><button onClick={() => setZoom(1)} aria-label="Fit canvas"><Maximize2 size={13} /></button></div>
      </div>
      <p className="canvas-mobile-hint">Zoom in and swipe to explore. Use Source list for readable details.</p>
    </div>
    {listView && <div className="theater-source-list">
      {sourceNodes.length === 0 && <p>No source has been selected. Clarify the metric and business context.</p>}
      {sourceNodes.map(node => <button key={node.id} onClick={() => onInspect(node)} aria-label={`${node.title}: ${statusLabels[node.status]}. Inspect evidence`}>
        {node.sourceId && <ToolIcon source={sources[node.sourceId]} />}<span><strong>{node.title}</strong><small>{node.sourceId && sources[node.sourceId].collections.join(' / ')}</small><span>{node.finding ?? node.error ?? node.purpose}</span></span><span className="list-status">{statusLabels[node.status]}<ArrowUpRight size={13} /></span>
      </button>)}
    </div>}
    <div className="theater-bottom">
      <div className="live-receipt" role="status" aria-live="polite">
        <span className="receipt-icon">{run.status === 'cancelled' ? <Square size={15} /> : running ? <Radar size={17} /> : <ShieldCheck size={17} />}</span>
        <AnimatePresence mode="wait"><motion.span key={running ? recent?.id ?? 'waiting' : run.status} initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <strong>{!supported ? 'Proposed investigation only' : run.status === 'cancelled' ? 'Cancelled. Completed evidence is preserved.' : running ? recent ? 'Evidence just arrived' : 'Dispatching simulated tool calls' : run.status === 'partial' ? 'Some sources are unavailable. Successful evidence is preserved.' : 'Evidence connected. Your answer is ready.'}</strong>
          <span>{running && recent ? run.nodes.find(node => node.id === recent.nodeId)?.finding : 'All connections, data transfers and findings in this workspace are simulated.'}</span>
        </motion.span></AnimatePresence>
        {run.answer && <button onClick={showAnswer}>View insight<ArrowDown size={13} /></button>}
      </div>
      <details className="canvas-activity"><summary><GitBranch size={13} />Tool activity<span>{run.events.length} events</span><ChevronDown size={13} /></summary>
        <ol>{run.events.map(event => <li key={event.id}><span>{String(event.id).padStart(2, '0')}</span>{event.message}</li>)}</ol>
      </details>
    </div>
  </section>
}
