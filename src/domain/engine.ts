import { generateAnswer } from './answers.ts'
import { discoveryCapabilities } from './fixtures.ts'
import { selectSources, sources } from './sources.ts'
import { authorizePlan, canUseSource, demoUsers } from './access.ts'
import type { DemoUser } from './access.ts'
import { demoPlanner } from './planner.ts'
import { describeSourceContext } from './semantics.ts'
import type { Connector, Evidence, Investigation, Plan, SourceId, WorkflowNode } from './types.ts'

function sourceNode(sourceId: SourceId, dependencies: string[] = []): WorkflowNode {
  return {
    id: sourceId, sourceId, kind: 'source', stage: 'discover', title: sources[sourceId].name,
    purpose: sources[sourceId].description, dependencies, status: 'planned',
  }
}

export function createInvestigation(plan: Plan, id: string = crypto.randomUUID()): Investigation {
  const nodes: WorkflowNode[] = plan.sources.map(sourceId => sourceNode(sourceId))
  nodes.push(
    { id: 'reconcile', kind: 'analysis', stage: 'reconcile', title: 'Connect the evidence', purpose: 'Reconcile definitions, periods, populations and cross-source signals.', dependencies: [...plan.sources], status: 'planned' },
    { id: 'answer', kind: 'synthesis', stage: 'answer', title: 'Build your answer', purpose: 'Summarize verified evidence, limitations and next steps.', dependencies: ['reconcile'], status: 'planned' },
  )
  return { id, turn: 1, turns: [], access: authorizePlan(plan, demoUsers[0]), plan, nodes, evidence: [], events: [], status: 'running' }
}

export class InvestigationEngine {
  private controller = new AbortController()
  private running = false
  private snapshot: Investigation
  private notify: (state: Investigation) => void
  private principal: DemoUser
  private excludedSources = new Set<SourceId>()

  constructor(plan: Plan, notify: (state: Investigation) => void, previous?: Investigation, principal = demoUsers[0]) {
    this.notify = notify
    this.principal = principal
    if (previous?.status === 'running') throw new Error('Wait for the current question to finish before continuing.')
    if (previous && previous.access.principalId !== principal.id) throw new Error('Conversations cannot be continued or reused between different demo users.')
    if (previous && [previous, ...previous.turns].some(turn => turn.evidence.some(item => !canUseSource(principal, item.sourceId)) ||
      (turn.answer && authorizePlan(turn.plan, principal).status === 'denied'))) {
      throw new Error('Demo access has changed. Start a new conversation instead of reusing evidence outside the current grants.')
    }
    const access = authorizePlan(plan, principal)
    this.excludedSources = new Set(plan.sources.filter(id => !canUseSource(principal, id)))
    plan = { ...plan, sources: access.status === 'denied' ? [] : plan.sources.filter(id => canUseSource(principal, id)) }
    this.snapshot = createInvestigation(plan, previous?.id)
    this.snapshot.access = access
    if (previous) {
      const { turns, ...lastTurn } = previous
      this.snapshot.turn = previous.turn + 1
      this.snapshot.turns = [...turns, lastTurn]
      this.snapshot.events = [...previous.events]
      const compatible = access.status !== 'denied' && previous.access.status !== 'denied' && previous.plan.scenario === plan.scenario && previous.plan.scope === plan.scope &&
        previous.plan.context.profile === plan.context.profile &&
        previous.plan.period === plan.period && previous.plan.comparison === plan.comparison &&
        plan.scenario !== 'unsupported'
      if (compatible) {
        for (const id of previous.access.excludedSourceIds) if (!canUseSource(principal, id)) this.excludedSources.add(id)
        this.snapshot.access = { ...access, excludedSourceCount: this.excludedSources.size, excludedSourceIds: [...this.excludedSources], status: this.excludedSources.size ? 'partial' : access.status, message: this.excludedSources.size ? previous.access.message : access.message }
        this.snapshot.evidence = [...previous.evidence]
        this.snapshot.nodes = previous.nodes.map(node => node.kind !== 'source'
          ? { ...node, status: 'planned', finding: undefined, activity: undefined }
          : node.status === 'complete'
            ? { ...node, reused: true, activity: 'Evidence retained for follow-up' }
            : node.status === 'cancelled'
              ? { ...node, status: 'planned', activity: undefined }
              : { ...node })
        for (const id of plan.sources) {
          if (!this.snapshot.nodes.some(node => node.sourceId === id)) this.snapshot.nodes.push(sourceNode(id))
        }
        const sourceIds = this.snapshot.nodes.filter(node => node.kind === 'source').map(node => node.id)
        this.snapshot.nodes = this.snapshot.nodes.map(node => node.id === 'reconcile' ? { ...node, dependencies: sourceIds } : node)
      }
      this.snapshot.nodes = this.snapshot.nodes.map(node => node.id === 'reconcile'
        ? { ...node, purpose: `Analyze follow-up ${this.snapshot.turn}: ${plan.question}` } : node)
      this.snapshot.events.push({
        id: this.snapshot.events.length + 1, nodeId: 'reconcile', status: 'planned',
        message: `Question ${this.snapshot.turn}: ${plan.question} ${compatible ? `${this.snapshot.evidence.length} evidence records retained; only new sources need retrieval.` : 'The scope changed; prior answers are preserved, but evidence must be retrieved for the new scope.'}`,
      })
      for (const node of this.snapshot.nodes.filter(node => node.reused)) {
        this.snapshot.events.push({ id: this.snapshot.events.length + 1, nodeId: node.id, status: 'complete', message: `${node.title}: reused existing evidence without a connector call` })
      }
    }
    if (access.status === 'denied') {
      this.snapshot.status = 'denied'
      this.snapshot.nodes = []
      this.snapshot.evidence = []
      this.snapshot.events = [{ id: 1, nodeId: 'access', status: 'error', message: 'Question denied by demo access policy. No source calls were made.' }]
    }
  }

  get state(): Investigation { return this.snapshot }

  private publish() {
    this.snapshot = { ...this.snapshot, nodes: [...this.snapshot.nodes], evidence: [...this.snapshot.evidence], events: [...this.snapshot.events] }
    this.notify(this.snapshot)
  }

  private update(id: string, patch: Partial<WorkflowNode>, message?: string) {
    this.snapshot.nodes = this.snapshot.nodes.map(node => node.id === id ? { ...node, ...patch } : node)
    if (message && patch.status) {
      this.snapshot.events.push({ id: this.snapshot.events.length + 1, nodeId: id, status: patch.status, message })
    }
    this.publish()
  }

  private addDiscoveries(item: Evidence) {
    const discovered = selectSources(discoveryCapabilities(item))
    for (const id of discovered) {
      if (!canUseSource(this.principal, id)) this.excludedSources.add(id)
    }
    if (this.excludedSources.size) this.snapshot.access = {
      ...this.snapshot.access, status: 'partial',
      excludedSourceCount: this.excludedSources.size, excludedSourceIds: [...this.excludedSources],
      message: 'Some requested or discovered sources are not permitted. This answer uses authorized evidence only and may be incomplete.',
    }
    const additional = discovered.filter(id => canUseSource(this.principal, id) && !this.snapshot.nodes.some(node => node.id === id))
    for (const sourceId of additional) {
      this.snapshot.nodes.push({ ...sourceNode(sourceId, [item.sourceId]), stage: 'investigate' })
    }
    if (additional.length) {
      const allSources = this.snapshot.nodes.filter(node => node.kind === 'source').map(node => node.id)
      this.update('reconcile', { dependencies: allSources })
    }
  }

  async execute(connector: Connector): Promise<void> {
    if (this.snapshot.status === 'denied') { this.publish(); return }
    if (this.running || this.snapshot.status === 'cancelled') return
    this.running = true
    this.publish()
    try {
      if (this.snapshot.plan.scenario !== 'unsupported') {
        while (!this.controller.signal.aborted) {
          const ready = this.snapshot.nodes.filter(node => node.kind === 'source' && node.status === 'planned' &&
            node.dependencies.every(id => this.snapshot.nodes.some(dep => dep.id === id && ['complete', 'empty', 'error', 'unconfigured'].includes(dep.status))))
          if (!ready.length) break
          await Promise.all(ready.map(async node => {
            const sourceId = node.sourceId
            if (!sourceId) throw new Error('Source task is missing a source identifier.')
            if (!canUseSource(this.principal, sourceId)) throw new Error('The current demo user is not authorized for this source.')
            if (sources[sourceId].handler === 'unconfigured') {
              const source = sources[sourceId]
              const context = source.semanticContext ? `\n${describeSourceContext(source, this.snapshot.plan)}` : ''
              this.update(node.id, { status: 'unconfigured', activity: 'Server connector required', finding: `This registered ${source.connectionKind === 'mcp' ? 'MCP server' : 'source'} is not connected. No query or tool was executed and no evidence was returned; a server-side adapter is required.${context}` }, `${node.title}: not connected; no connector call was made`)
              return
            }
            this.update(node.id, { status: 'retrieving' }, `${node.title}: retrieving simulated evidence`)
            try {
              const result = await connector.retrieve({
                source: sources[sourceId], plan: this.snapshot.plan, signal: this.controller.signal,
                onActivity: (status, activity) => {
                  if (!this.controller.signal.aborted) this.update(node.id, { status, activity }, `${node.title}: ${activity}`)
                },
              })
              if (this.controller.signal.aborted) return
              if (!result) {
                this.update(node.id, { status: 'empty', activity: undefined, finding: 'No matching demo evidence. Coverage is not established.' }, `${node.title}: no matching demo evidence`)
                return
              }
              if (result.sourceId !== sourceId || result.period !== this.snapshot.plan.period || result.comparison !== this.snapshot.plan.comparison) throw new Error('Connector evidence does not match the requested source or reporting windows.')
              this.update(node.id, { status: 'analyzing' })
              this.snapshot.evidence.push(result)
              this.update(node.id, { status: 'complete', activity: undefined, evidenceId: result.id, finding: result.finding }, `${node.title}: evidence ready`)
              this.addDiscoveries(result)
            } catch (error) {
              if (this.controller.signal.aborted) return
              this.update(node.id, { status: 'error', activity: undefined, error: error instanceof Error ? error.message : 'Connector failed with an unrecognized error. Retry or inspect the adapter.' }, `${node.title}: source unavailable`)
            }
          }))
        }
      }
      if (this.controller.signal.aborted) return
      this.update('reconcile', { status: 'analyzing' }, `Analyzing question ${this.snapshot.turn}: ${this.snapshot.plan.question}. Reconciling available evidence and documenting coverage gaps.`)
      this.update('reconcile', { status: 'complete', finding: this.snapshot.plan.scenario === 'unsupported' ? 'Proposed sources only. No demo results are available.' : `${this.snapshot.evidence.length} synthetic evidence records; definitions and periods included.` })
      this.update('answer', { status: 'analyzing' })
      this.snapshot.answer = generateAnswer(this.snapshot)
      this.snapshot.answer.followUps = this.snapshot.answer.followUps.filter(question =>
        authorizePlan(demoPlanner.plan(question, this.snapshot.plan.context.profile, this.snapshot.plan), this.principal).status !== 'denied')
      this.snapshot.status = this.snapshot.access.status === 'partial' || this.snapshot.nodes.some(node => node.status === 'error' || node.status === 'unconfigured') ? 'partial' : 'complete'
      this.update('answer', { status: 'complete', finding: this.snapshot.answer.headline }, 'Answer ready from available evidence')
    } finally {
      this.running = false
    }
  }

  cancel() {
    if (!this.running || this.snapshot.status !== 'running') return
    this.controller.abort()
    this.snapshot.status = 'cancelled'
    this.snapshot.nodes = this.snapshot.nodes.map(node => ['planned', 'retrieving', 'analyzing'].includes(node.status) ? { ...node, status: 'cancelled', activity: undefined } : node)
    this.publish()
  }

  async retry(connector: Connector): Promise<void> {
    if (this.running || !['partial', 'cancelled'].includes(this.snapshot.status)) return
    if (this.snapshot.status === 'partial' && !this.snapshot.nodes.some(node => node.status === 'error')) throw new Error('There are no failed connectors to retry. Unconnected sources require a server adapter; permission exclusions require the appropriate grants.')
    this.controller = new AbortController()
    this.snapshot.status = 'running'
    this.snapshot.answer = undefined
    this.snapshot.nodes = this.snapshot.nodes.map(node => ['error', 'cancelled'].includes(node.status) || node.kind !== 'source'
      ? { ...node, status: 'planned', error: undefined, finding: undefined, activity: undefined } : node)
    await this.execute(connector)
  }
}
