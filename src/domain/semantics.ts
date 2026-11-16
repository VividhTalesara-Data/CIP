import { configText, identifier, isRecord } from './config-validation.ts'
import type { Aggregation, FieldRole, FieldType, Metric, Plan, SemanticContext, SemanticField, SemanticMetric, SourceDefinition } from './types.ts'

export const fieldTypes: FieldType[] = ['string', 'number', 'date', 'boolean']
export const fieldRoles: FieldRole[] = ['identifier', 'dimension', 'measure', 'time']
export const metricIntents: Metric[] = ['openings', 'conversion', 'retention', 'engagement', 'support', 'campaign', 'social', 'performance', 'transfers', 'appointments', 'unknown']
const isFieldType = (value: unknown): value is FieldType => fieldTypes.some(type => type === value)
const isFieldRole = (value: unknown): value is FieldRole => fieldRoles.some(role => role === value)
const isMetric = (value: unknown): value is Metric => metricIntents.some(metric => metric === value)

export function fieldAggregations(role: FieldRole): Aggregation[] {
  if (role === 'measure') return ['none', 'sum', 'avg', 'min', 'max', 'count', 'count_distinct']
  if (role === 'time') return ['none', 'min', 'max', 'count', 'count_distinct']
  return ['none', 'count', 'count_distinct']
}

export function validateSemanticContext(value: unknown, timeField: string): SemanticContext | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || !Array.isArray(value.fields) || !value.fields.length || value.fields.length > 100 ||
    !Array.isArray(value.metrics) || value.metrics.length > 50) throw new Error('Data context needs 1-100 documented fields and at most 50 metric mappings.')
  const grain = configText(value.grain, 'Dataset grain', 300)
  const timezone = configText(value.timezone, 'Timezone', 80)
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0) } catch { throw new Error('Enter a valid IANA timezone, such as UTC or America/New_York.') }
  const names = new Set<string>()
  const fields: SemanticField[] = value.fields.map(field => {
    if (!isRecord(field) || !isFieldType(field.dataType) || !isFieldRole(field.role)) throw new Error('Each field needs a valid data type and semantic role.')
    const name = configText(field.name, 'Field name', 100)
    if (!identifier.test(name) || names.has(name.toLowerCase())) throw new Error('Field names must be valid, unique identifiers.')
    names.add(name.toLowerCase())
    if ((field.role === 'measure' && field.dataType !== 'number') || (field.role === 'time' && field.dataType !== 'date')) throw new Error('Measures must be numeric and time fields must use the date type.')
    const aggregation = fieldAggregations(field.role).find(item => item === field.aggregation)
    if (!aggregation) throw new Error('This aggregation is not permitted for the field role. Identifiers and dimensions cannot be summed or averaged.')
    return { name, description: configText(field.description, 'Field meaning', 600), dataType: field.dataType, role: field.role, aggregation, unit: configText(field.unit, 'Field unit', 80, false) }
  })
  if (!fields.some(field => field.name === timeField && field.role === 'time')) throw new Error('Document the configured time field with the time role before saving data context.')
  const metrics: SemanticMetric[] = value.metrics.map(metric => {
    if (!isRecord(metric) || !isMetric(metric.intent)) throw new Error('Each metric needs a valid question intent.')
    const field = configText(metric.field, 'Metric field', 100)
    if (!fields.some(item => item.name === field)) throw new Error('Metric mappings must reference a documented field.')
    return { intent: metric.intent, name: configText(metric.name, 'Metric name', 100), field, definition: configText(metric.definition, 'Metric definition', 1000), filters: configText(metric.filters, 'Metric filters', 600, false) }
  })
  if (new Set(metrics.map(metric => metric.name.toLowerCase())).size !== metrics.length) throw new Error('Metric names must be unique within a source.')
  return { grain, timezone, fields, metrics, businessDefinitions: configText(value.businessDefinitions, 'Business definitions', 3000, false), caveats: configText(value.caveats, 'Data caveats', 3000, false) }
}

export function metricMappingsForQuestion(source: SourceDefinition, plan: Plan) {
  return source.semanticContext?.metrics.filter(metric => plan.context.metrics.includes(metric.intent)) ?? []
}

export function describeSourceContext(source: SourceDefinition, plan?: Plan): string {
  const context = source.semanticContext
  if (!context) return 'No field-level context has been documented. The agent must not infer field meanings or aggregation rules.'
  const mappings = plan ? metricMappingsForQuestion(source, plan) : context.metrics
  return [
    `Dataset reference: ${Object.entries(source.connectionProperties ?? {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'Not specified'}`,
    `Dataset grain: ${context.grain}`, `Time field: ${source.timeField} (${context.timezone})`,
    `Business definitions: ${context.businessDefinitions || 'Not specified'}`,
    'Documented fields:',
    ...context.fields.map(field => `${field.name}: ${field.description} | ${field.dataType}, ${field.role} | Approved aggregation: ${field.aggregation.toUpperCase()}${field.unit ? ` | Unit: ${field.unit}` : ''}`),
    plan ? 'Metric mappings matching this question:' : 'Governed metric mappings:',
    ...mappings.map(metric => {
      const field = context.fields.find(item => item.name === metric.field)
      if (!field) throw new Error('A semantic metric references an undocumented field.')
      return `${metric.name} [${metric.intent}]: ${field.aggregation === 'none' ? `No automatic aggregation approved for ${field.name}` : `${field.aggregation.toUpperCase()}(${field.name})`}. ${metric.definition}${metric.filters ? ` Filters: ${metric.filters}` : ''}`
    }),
    ...(mappings.length ? [] : ['No approved metric mapping matches; clarification is required before aggregation.']),
    `Caveats: ${context.caveats || 'Not specified'}`,
    'Proposed context only. No schema was discovered and no SQL or aggregation was executed.',
  ].join('\n')
}
