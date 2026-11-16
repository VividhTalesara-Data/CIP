import { profiles } from './profiles.ts'
import { sources } from './sources.ts'
import { demoUsers } from './access.ts'
import { describeSourceContext } from './semantics.ts'
import type { Confidence, Investigation } from './types.ts'

export const demoAnalysts = [
  { id: 'retirement-analyst', name: 'Maya Chen', specialty: 'Retirement analytics' },
  { id: 'digital-analyst', name: 'Alex Morgan', specialty: 'Digital journeys' },
  { id: 'service-analyst', name: 'Sam Rivera', specialty: 'Customer engagement' },
]

export type ReviewPriority = 'Normal' | 'High'
export interface ReviewSection { title: string; content: string }
export interface ReviewTicket {
  version: 1
  id: string
  ownerId: string
  key: string
  createdAt: string
  assignee: string
  priority: ReviewPriority
  reviewQuestion: string
  analysisId: string
  originalQuestion: string
  headline: string
  sections: ReviewSection[]
}

const storagePrefix = 'clarity:analyst-review:v1:'
const validId = (id: string) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)
const describeConfidence = ({ score, explanation }: Confidence) =>
  `Demo confidence: ${score === null ? 'Not assessed' : `${score}%`}. ${explanation}`

export function createReviewTicket(run: Investigation, analystId: string, question: string, priority: ReviewPriority): ReviewTicket {
  const analyst = demoAnalysts.find(item => item.id === analystId)
  if (!analyst) throw new Error('Choose a sample analyst for this review.')
  const reviewQuestion = question.trim()
  if (!reviewQuestion || reviewQuestion.length > 2000) throw new Error('Enter a review question between 1 and 2,000 characters.')
  if (priority !== 'Normal' && priority !== 'High') throw new Error('Choose a valid review priority.')
  const { answer, plan } = run
  if (!answer || !['complete', 'partial'].includes(run.status)) throw new Error('Wait for the analysis to finish before assigning a review.')

  const sections: ReviewSection[] = [
    {
      title: 'Conversation context',
      content: `Conversation ID: ${run.id}\nCurrent question: ${run.turn}\n${run.turns.map(turn => `Question ${turn.turn}: ${turn.plan.question}\n${turn.answer ? `${turn.answer.headline}\n${turn.answer.summary}` : 'No completed answer.'}`).join('\n\n')}`,
    },
    {
      title: 'Generated analysis',
      content: `${answer.headline}\n\n${answer.summary}\n\n${describeConfidence(answer.confidence)}\nInvestigation status: ${run.status}\nAnalysis ID: ${run.id}`,
    },
    {
      title: 'Question, scope and reporting windows',
      content: `Original question: ${plan.question}\nPerspective: ${profiles[plan.context.profile].label}\nScope: ${plan.scope}\nSelected period: ${plan.period}\nComparison: ${plan.comparison}\nTimezone: UTC\n\nPlanner context:\n${JSON.stringify(plan.context, null, 2)}\n\nAssumptions:\n${plan.assumptions.join('\n')}\n${plan.limitation ?? ''}\n${plan.clarification ?? ''}`,
    },
    {
      title: 'Metrics',
      content: answer.metrics.map(item => `${item.label}: ${item.value}\n${item.detail}\nEvidence: ${item.evidenceId}\n${describeConfidence(item.confidence)}`).join('\n\n') || 'No supported metrics were generated.',
    },
    {
      title: 'Findings and evidence references',
      content: answer.findings.map(item => `${item.strength}: ${item.text}\nEvidence: ${item.evidenceIds.join(', ')}\n${describeConfidence(item.confidence)}`).join('\n\n') || 'No supported findings were generated.',
    },
    {
      title: 'Question-specific evidence highlights',
      content: answer.highlights.map(item => `${item.title}\n${item.observation}\n${item.summary}\n${item.excerpt ? `Scripted demo excerpt - not a real transcript or representative sample (${item.excerpt.label}):\n${item.excerpt.text}\n` : ''}Caveat: ${item.caveat}\nEvidence: ${item.evidenceId}\n${describeConfidence(item.confidence)}`).join('\n\n') || 'No additional evidence highlights were available for this question.',
    },
    { title: 'Limitations and coverage gaps', content: answer.limitations.join('\n\n') },
    { title: 'Suggested next steps', content: answer.recommendations.join('\n\n') || 'No recommendations were generated.' },
  ]
  if (answer.chart) sections.push({
    title: 'Chart and exact values',
    content: `${answer.chart.title}\nUnit: ${answer.chart.unit}\nEvidence: ${answer.chart.evidenceId}\n${describeConfidence(answer.chart.confidence)}\n\nGroup | Comparison | Selected period\n${answer.chart.rows.map(row => `${row.label} | ${row.baseline} | ${row.current}`).join('\n')}`,
  })
  for (const node of run.nodes.filter(item => item.kind === 'source')) {
    if (!node.sourceId) throw new Error('A source is missing its identifier; the handoff cannot be created.')
    const source = sources[node.sourceId]
    const evidence = run.evidence.find(item => item.id === node.evidenceId)
    const retrieval = node.reused ? 'Compatible evidence reused; no new retrieval.'
      : node.status === 'unconfigured' ? 'Registered but not connected; no connector call or fixture lookup was executed.'
      : node.status === 'planned' ? 'Proposed only; retrieval was not executed.'
        : node.status === 'error' ? 'Simulated connector failed; no evidence returned.'
          : node.status === 'empty' ? 'Simulated fixture lookup returned no matching evidence.'
            : node.status === 'complete' ? 'Simulated fixture lookup completed.'
              : `Retrieval status: ${node.status}.`
    sections.push({
      title: `Source: ${source.name} (${node.status})`,
      content: `Platform: ${source.platform}\nSource ID: ${source.id}\nPurpose: ${node.purpose}\nStatus: ${node.status}\n${retrieval}\n${node.error ?? ''}\nDependencies: ${node.dependencies.join(', ') || 'None'}\n\nPlaceholder collections: ${source.collections.join(', ')}\nCandidate join keys: ${source.joinKeys.join(', ')} (not proof of a valid join)\nTime field: ${source.timeField} / UTC\nConfigured access requirement (not enforced by this demo): ${source.access}\n\nQueries used: No SQL or external query was executed. ${source.handler === 'unconfigured' ? 'No adapter is implemented for this registered source.' : 'This demo uses createDemoConnector / getFixture in src/domain/fixtures.ts.'}\nLookup inputs${node.status === 'error' || node.status === 'planned' || node.status === 'unconfigured' || node.reused ? ' (reference only; not executed in this run)' : ''}:\n${JSON.stringify({ sourceId: source.id, plan }, null, 2)}\n\n${evidence ? `Evidence snapshot (synthetic):\n${JSON.stringify(evidence, null, 2)}` : 'Evidence: unavailable; no values are inferred.'}`,
    })
  }
  sections.push(
    { title: 'Governed source context', content: run.nodes.filter(node => node.sourceId && sources[node.sourceId].semanticContext).map(node => `${node.title}\n${describeSourceContext(sources[node.sourceId!], plan)}`).join('\n\n') || 'No additional field-level context has been configured for these sources.' },
    { title: 'Workflow activity', content: run.events.map(event => `${event.id}. ${event.nodeId} [${event.status}] ${event.message}`).join('\n') || 'No retrieval activity was recorded.' },
    {
      title: 'Requested review outcome',
      content: 'Answer the review question with a supported conclusion.\nReproduce the metrics for the same population and reporting windows.\nValidate definitions, filters, candidate joins and source coverage.\nSeparate observations from associations; investigate alternative explanations.\nDocument corrections, unresolved gaps and evidence needed before an executive decision.',
    },
  )
  const id = crypto.randomUUID()
  return {
    version: 1, id, ownerId: run.access.principalId, key: `DEMO-${id.slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(),
    assignee: `${analyst.name} (sample) - ${analyst.specialty}`, priority, reviewQuestion,
    analysisId: run.id, originalQuestion: plan.question, headline: answer.headline, sections,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isSection = (value: unknown): value is ReviewSection =>
  isRecord(value) && typeof value.title === 'string' && typeof value.content === 'string'

function readStoredReview(storage: Pick<Storage, 'getItem'>, id: string): ReviewTicket {
  if (!validId(id)) throw new Error('This demo review link is invalid.')
  const raw = storage.getItem(storagePrefix + id)
  if (!raw) throw new Error('This demo review is not saved here. Open the link in the same browser and app address where it was created; clearing browser storage removes saved reviews.')
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.version !== 1 || value.id !== id ||
    value.key !== `DEMO-${id.slice(0, 8).toUpperCase()}` ||
    typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt)) ||
    (value.ownerId !== undefined && typeof value.ownerId !== 'string') ||
    typeof value.assignee !== 'string' || (value.priority !== 'Normal' && value.priority !== 'High') ||
    typeof value.reviewQuestion !== 'string' || typeof value.analysisId !== 'string' ||
    typeof value.originalQuestion !== 'string' || typeof value.headline !== 'string' ||
    !Array.isArray(value.sections) || !value.sections.length || !value.sections.every(isSection)) {
    throw new Error('This saved demo review is damaged or uses an unsupported format. It cannot be opened.')
  }
  return {
    version: 1, id, ownerId: typeof value.ownerId === 'string' ? value.ownerId : demoUsers[0].id, key: value.key, createdAt: value.createdAt, assignee: value.assignee,
    priority: value.priority, reviewQuestion: value.reviewQuestion, analysisId: value.analysisId,
    originalQuestion: value.originalQuestion, headline: value.headline, sections: value.sections,
  }
}

export function readReviewTicket(storage: Pick<Storage, 'getItem'>, id: string, principalId = demoUsers[0].id): ReviewTicket {
  const ticket = readStoredReview(storage, id)
  if (ticket.ownerId !== principalId) throw new Error('You do not have permission to open this saved demo review.')
  return ticket
}

export function saveReviewTicket(storage: Pick<Storage, 'getItem' | 'setItem'>, ticket: ReviewTicket) {
  if (storage.getItem(storagePrefix + ticket.id) !== null) throw new Error('This demo review already exists; it was not overwritten.')
  storage.setItem(storagePrefix + ticket.id, JSON.stringify(ticket))
}

export function listReviewTickets(storage: Storage, principalId = demoUsers[0].id): ReviewTicket[] {
  const tickets: ReviewTicket[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(storagePrefix)) {
      const ticket = readStoredReview(storage, key.slice(storagePrefix.length))
      if (ticket.ownerId === principalId) tickets.push(ticket)
    }
  }
  return tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function reviewLink(id: string, view: 'review' | 'analysis', baseUrl: string) {
  const url = new URL(baseUrl)
  url.hash = new URLSearchParams({ [view]: id }).toString()
  return url.href
}
