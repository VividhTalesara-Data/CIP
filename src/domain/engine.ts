import { generateAnswer } from './answers.ts'
import { discoveryCapabilities } from './fixtures.ts'
import { selectSources, sources } from './sources.ts'
import type { Connector, Evidence, Investigation, Plan, WorkflowNode } from './types.ts'

export function createInvestigation(plan: Plan, id = crypto.randomUUID()): Investigation {
  const nodes: WorkflowNode[] = plan.sources.map(sourceId => ({
    id: sourceId, sourceId, kind: 'source', stage: 'discover', title: sources[sourceId].name,
    purpose: sources[sourceId].description, dependencies: [], status: 'planned',
  }))
  nodes.push(
    { id: 'reconcile', kind: 'analysis', stage: 'reconcile', title: 'Connect the evidence', purpose: 'Reconcile definitions, periods, populations and cross-source signals.', dependencies: [...plan.sources], status: 'planned' },
    { id: 'answer', kind: 'synthesis', stage: 'answer', title: 'Build your answer', purpose: 'Summarize verified evidence, limitations and next steps.', dependencies: ['reconcile'], status: 'planned' },
  )
  return { id, plan, nodes, evidence: [], events: [], status: 'running' }
}

export class InvestigationEngine {
  private controller = new AbortController()
  private running = false
  private snapshot: Investigation
  private notify: (state: Investigation) => void
  private reusable: Evidence[]

  constructor(plan: Plan, notify: (state: Investigation) => void, previous?: Investigation) {
    this.snapshot = createInvestigation(plan)
    this.notify = notify
    this.reusable = previous && previous.plan.scenario === plan.scenario && previous.plan.scope === plan.scope &&
      previous.plan.period === plan.period && previous.plan.comparison === plan.comparison ? previous.evidence : []
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
    const additional = selectSources(discoveryCapabilities(item)).filter(id => !this.snapshot.nodes.some(node => node.id === id))
    for (const sourceId of additional) {
      this.snapshot.nodes.push({
        id: sourceId, sourceId, kind: 'source', stage: 'investigate', title: sources[sourceId].name,
        purpose: sources[sourceId].description, dependencies: [item.sourceId], status: 'planned',
      })
    }
    if (additional.length) {
      const allSources = this.snapshot.nodes.filter(node => node.kind === 'source').map(node => node.id)
      this.update('reconcile', { dependencies: allSources })
    }
  }

  async execute(connector: Connector): Promise<void> {
    if (this.running || this.snapshot.status === 'cancelled') return
    this.running = true
    this.publish()
    try {
      if (this.snapshot.plan.scenario !== 'unsupported') {
        while (!this.controller.signal.aborted) {
          const ready = this.snapshot.nodes.filter(node => node.kind === 'source' && node.status === 'planned' &&
            node.dependencies.every(id => this.snapshot.nodes.some(dep => dep.id === id && ['complete', 'empty', 'error'].includes(dep.status))))
          if (!ready.length) break
          await Promise.all(ready.map(async node => {
            const sourceId = node.sourceId
            if (!sourceId) throw new Error('Source task is missing a source identifier.')
            const cached = this.reusable.find(item => item.sourceId === sourceId)
            if (cached) {
              this.snapshot.evidence.push(cached)
              this.update(node.id, { status: 'complete', evidenceId: cached.id, finding: cached.finding, reused: true }, `${node.title}: reused compatible synthetic evidence`)
              this.addDiscoveries(cached)
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
      this.update('reconcile', { status: 'analyzing' }, 'Reconciling available evidence and documenting coverage gaps')
      this.update('reconcile', { status: 'complete', finding: this.snapshot.plan.scenario === 'unsupported' ? 'Proposed sources only. No demo results are available.' : `${this.snapshot.evidence.length} synthetic evidence records; definitions and periods included.` })
      this.update('answer', { status: 'analyzing' })
      this.snapshot.answer = generateAnswer(this.snapshot)
      this.snapshot.status = this.snapshot.nodes.some(node => node.status === 'error') ? 'partial' : 'complete'
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
    this.controller = new AbortController()
    this.snapshot.status = 'running'
    this.snapshot.answer = undefined
    this.snapshot.nodes = this.snapshot.nodes.map(node => ['error', 'cancelled'].includes(node.status) || node.kind !== 'source'
      ? { ...node, status: 'planned', error: undefined, finding: undefined, activity: undefined } : node)
    await this.execute(connector)
  }
}
