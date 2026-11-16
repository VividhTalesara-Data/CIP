export type ProfileId = 'retirement' | 'wealth' | 'digital' | 'service'
export type Intent = 'descriptive' | 'comparative' | 'diagnostic' | 'exploratory'
export type Metric = 'openings' | 'conversion' | 'retention' | 'engagement' | 'support' | 'campaign' | 'social' | 'performance' | 'transfers' | 'appointments' | 'unknown'
export type Scenario = 'conversion' | 'roth' | 'hsa' | 'volatility' | 'retention' | 'rollovers' | 'unsupported'
export type Capability = 'accounts' | 'journeys' | 'mobile' | 'releases' | 'incidents' | 'calls' | 'assistant' | 'chat' | 'search' | 'campaigns' | 'policies' | 'market' | 'trading' | 'customers' | 'retention' | 'money' | 'retirement' | 'appointments' | 'social' | 'social-live'
export type CustomSourceId = `custom:${string}`
export type McpSourceId = `mcp:${string}`
export type SourceId = Capability | CustomSourceId | McpSourceId
export type NodeStatus = 'planned' | 'retrieving' | 'analyzing' | 'complete' | 'empty' | 'error' | 'cancelled' | 'unconfigured'
export type RunStatus = 'running' | 'complete' | 'partial' | 'cancelled' | 'denied'
export type Stage = 'discover' | 'investigate' | 'reconcile' | 'answer'

export type FieldType = 'string' | 'number' | 'date' | 'boolean'
export type FieldRole = 'identifier' | 'dimension' | 'measure' | 'time'
export type Aggregation = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct'
export interface SemanticField {
  name: string
  description: string
  dataType: FieldType
  role: FieldRole
  aggregation: Aggregation
  unit: string
}
export interface SemanticMetric {
  intent: Metric
  name: string
  field: string
  definition: string
  filters: string
}
export interface SemanticContext {
  grain: string
  timezone: string
  businessDefinitions: string
  caveats: string
  fields: SemanticField[]
  metrics: SemanticMetric[]
}

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
  handler: 'demo' | 'unconfigured'
  connectionKey: string
  allowedUserIds?: string[]
  providerId?: string
  connectionKind?: 'data' | 'mcp'
  semanticContext?: SemanticContext
  connectionProperties?: Record<string, string>
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
  contextQuestion?: string
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

export interface EvidenceContext {
  category: 'engagement' | 'market' | 'business'
  title: string
  summary: string
  excerpt?: { label: string; text: string }
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
  context?: EvidenceContext
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

export interface Confidence {
  score: number | null
  explanation: string
}

export interface Answer {
  headline: string
  summary: string
  confidence: Confidence
  metrics: { label: string; value: string; detail: string; evidenceId: string; confidence: Confidence }[]
  findings: { text: string; evidenceIds: string[]; strength: 'Observed' | 'Association' | 'Limitation'; confidence: Confidence }[]
  highlights: (EvidenceContext & { observation: string; caveat: string; sourceId: SourceId; evidenceId: string; confidence: Confidence })[]
  chart?: { title: string; unit: string; rows: Evidence['rows']; evidenceId: string; confidence: Confidence }
  recommendations: string[]
  limitations: string[]
  followUps: string[]
}

export interface AccessSummary {
  principalId: string
  status: 'allowed' | 'partial' | 'denied'
  excludedSourceCount: number
  excludedSourceIds: SourceId[]
  message: string
}

export interface InvestigationTurn {
  id: string
  turn: number
  access: AccessSummary
  plan: Plan
  nodes: WorkflowNode[]
  evidence: Evidence[]
  events: WorkflowEvent[]
  status: RunStatus
  answer?: Answer
}

export interface Investigation extends InvestigationTurn {
  turns: InvestigationTurn[]
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
