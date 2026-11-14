export type ProfileId = 'retirement' | 'wealth' | 'digital' | 'service'
export type Intent = 'descriptive' | 'comparative' | 'diagnostic' | 'exploratory'
export type Metric = 'openings' | 'conversion' | 'retention' | 'engagement' | 'support' | 'campaign' | 'social' | 'performance' | 'transfers' | 'appointments' | 'unknown'
export type Scenario = 'conversion' | 'roth' | 'hsa' | 'volatility' | 'retention' | 'rollovers' | 'unsupported'
export type Capability = 'accounts' | 'journeys' | 'mobile' | 'releases' | 'incidents' | 'calls' | 'assistant' | 'chat' | 'search' | 'campaigns' | 'policies' | 'market' | 'trading' | 'customers' | 'retention' | 'money' | 'retirement' | 'appointments' | 'social' | 'social-live'
export type SourceId = Capability
export type NodeStatus = 'planned' | 'retrieving' | 'analyzing' | 'complete' | 'empty' | 'error' | 'cancelled'
export type RunStatus = 'running' | 'complete' | 'partial' | 'cancelled'
export type Stage = 'discover' | 'investigate' | 'reconcile' | 'answer'

export interface SourceDefinition {
  id: SourceId
  name: string
  platform: string
  description: string
  capabilities: Capability[]
  domains: string[]
  collections: string[]
  joinKeys: string[]
  timeField: string
  freshness: string
  access: string
  handler: 'demo'
  connectionKey: string
}

export interface QuestionContext {
  intent: Intent
  metrics: Metric[]
  products: string[]
  channels: string[]
  entities: string[]
  profile: ProfileId
  requestedPeriod: string
}

export interface Plan {
  question: string
  context: QuestionContext
  scenario: Scenario
  sources: SourceId[]
  scope: string
  period: string
  comparison: string
  assumptions: string[]
  limitation?: string
  clarification?: string
}

export interface Evidence {
  id: string
  sourceId: SourceId
  title: string
  finding: string
  definition: string
  values: Record<string, number>
  rows: { label: string; baseline: number; current: number }[]
  unit: string
  signals: Capability[]
  period: string
  comparison: string
  grain: string
  caveat: string
  retrievedAt: string
  synthetic: true
}

export interface WorkflowNode {
  id: string
  sourceId?: SourceId
  kind: 'source' | 'analysis' | 'synthesis'
  title: string
  purpose: string
  stage: Stage
  dependencies: string[]
  status: NodeStatus
  evidenceId?: string
  finding?: string
  error?: string
  reused?: boolean
  activity?: string
}

export interface WorkflowEvent {
  id: number
  nodeId: string
  status: NodeStatus
  message: string
}

export interface Answer {
  headline: string
  summary: string
  metrics: { label: string; value: string; detail: string; evidenceId: string }[]
  findings: { text: string; evidenceIds: string[]; strength: 'Observed' | 'Association' | 'Limitation' }[]
  chart?: { title: string; unit: string; rows: Evidence['rows']; evidenceId: string }
  recommendations: string[]
  limitations: string[]
  followUps: string[]
}

export interface Investigation {
  id: string
  plan: Plan
  nodes: WorkflowNode[]
  evidence: Evidence[]
  events: WorkflowEvent[]
  status: RunStatus
  answer?: Answer
}

export interface ConnectorRequest {
  source: SourceDefinition
  plan: Plan
  signal: AbortSignal
  onActivity?: (status: 'retrieving' | 'analyzing', activity: string) => void
}

export interface Connector {
  retrieve(request: ConnectorRequest): Promise<Evidence | null>
}

export interface Planner {
  plan(question: string, profile: ProfileId, previous?: Plan): Plan
}
