import { Plus, Trash2 } from 'lucide-react'
import { fieldAggregations, fieldRoles, fieldTypes, metricIntents } from '../domain/semantics.ts'
import type { SemanticContext, SemanticField, SemanticMetric } from '../domain/types.ts'

const emptyContext: SemanticContext = { grain: '', timezone: 'UTC', businessDefinitions: '', caveats: '', fields: [], metrics: [] }

export default function SemanticEditor({ value, onChange }: { value?: SemanticContext; onChange: (value: SemanticContext | undefined) => void }) {
  const updateField = (index: number, patch: Partial<SemanticField>) => {
    if (value) onChange({ ...value, fields: value.fields.map((field, i) => i === index ? { ...field, ...patch } : field) })
  }
  const updateMetric = (index: number, patch: Partial<SemanticMetric>) => {
    if (value) onChange({ ...value, metrics: value.metrics.map((metric, i) => i === index ? { ...metric, ...patch } : metric) })
  }
  return <fieldset className="semantic-editor"><legend>Data meaning and aggregation</legend>
    <p>Document what each record and field means. Only approved metric mappings are supplied as proposed agent context; no SQL is executed. Missing definitions are never guessed.</p>
    <label className="context-enable"><input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked ? { ...emptyContext, fields: [], metrics: [] } : undefined)} />Add field-level data context</label>
    {value && <>
      <div className="source-admin-grid"><label>Dataset grain<input required maxLength={300} value={value.grain} onChange={event => onChange({ ...value, grain: event.target.value })} placeholder="One row per account-opening event" /></label><label>Timezone<input required maxLength={80} value={value.timezone} onChange={event => onChange({ ...value, timezone: event.target.value })} placeholder="UTC" /></label></div>
      <label>Business definitions<textarea rows={3} maxLength={3000} value={value.businessDefinitions} onChange={event => onChange({ ...value, businessDefinitions: event.target.value })} placeholder="Define opened, funded, active, eligible, retained..." /></label>
      <div className="semantic-heading"><h4>Documented fields</h4><button type="button" onClick={() => onChange({ ...value, fields: [...value.fields, { name: '', description: '', dataType: 'string', role: 'dimension', aggregation: 'none', unit: '' }] })}><Plus size={14} />Add field</button></div>
      <p>Include the configured time field. Identifiers and dimensions cannot be summed or averaged. NONE means automatic aggregation is not approved.</p>
      {value.fields.map((field, index) => <fieldset className="semantic-row" key={index}><legend>Field {index + 1}</legend><div className="source-admin-grid">
        <label>Field {index + 1} name<input required value={field.name} onChange={event => updateField(index, { name: event.target.value })} placeholder="account_id" /></label>
        <label>Field {index + 1} meaning<input required value={field.description} onChange={event => updateField(index, { description: event.target.value })} placeholder="Stable identifier for an account" /></label>
        <label>Field {index + 1} role<select value={field.role} onChange={event => {
          const role = fieldRoles.find(item => item === event.target.value)
          if (role) updateField(index, { role, dataType: role === 'measure' ? 'number' : role === 'time' ? 'date' : field.dataType, aggregation: fieldAggregations(role).includes(field.aggregation) ? field.aggregation : 'none' })
        }}>{fieldRoles.map(role => <option key={role}>{role}</option>)}</select></label>
        <label>Field {index + 1} type<select value={field.dataType} onChange={event => {
          const dataType = fieldTypes.find(item => item === event.target.value)
          if (dataType) updateField(index, { dataType })
        }}>{fieldTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Field {index + 1} aggregation<select value={field.aggregation} onChange={event => {
          const aggregation = fieldAggregations(field.role).find(item => item === event.target.value)
          if (aggregation) updateField(index, { aggregation })
        }}>{fieldAggregations(field.role).map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
        <label>Field {index + 1} unit<input value={field.unit} onChange={event => updateField(index, { unit: event.target.value })} placeholder="accounts, USD, percentage points..." /></label>
      </div><button type="button" className="remove-config" aria-label={`Remove field ${index + 1}`} onClick={() => onChange({ ...value, fields: value.fields.filter((_, i) => i !== index) })}><Trash2 size={14} />Remove field</button></fieldset>)}
      <div className="semantic-heading"><h4>Question-to-metric mappings</h4><button type="button" onClick={() => onChange({ ...value, metrics: [...value.metrics, { intent: 'openings', name: '', field: '', definition: '', filters: '' }] })}><Plus size={14} />Add metric mapping</button></div>
      {value.metrics.map((metric, index) => <fieldset className="semantic-row" key={index}><legend>Metric {index + 1}</legend><div className="source-admin-grid">
        <label>Metric {index + 1} name<input required value={metric.name} onChange={event => updateMetric(index, { name: event.target.value })} placeholder="Accounts opened" /></label>
        <label>Metric {index + 1} question intent<select value={metric.intent} onChange={event => {
          const intent = metricIntents.find(item => item === event.target.value)
          if (intent) updateMetric(index, { intent })
        }}>{metricIntents.map(intent => <option key={intent}>{intent}</option>)}</select></label>
        <label>Metric {index + 1} field<select required value={metric.field} onChange={event => updateMetric(index, { field: event.target.value })}><option value="">Choose a documented field</option>{value.fields.filter(field => field.name).map((field, i) => <option key={`${i}:${field.name}`} value={field.name}>{field.name} · {field.aggregation.toUpperCase()}</option>)}</select></label>
        <label>Metric {index + 1} filters<input value={metric.filters} onChange={event => updateMetric(index, { filters: event.target.value })} placeholder="Exclude test accounts; use selected reporting window" /></label>
      </div><label>Metric {index + 1} definition<textarea required rows={2} value={metric.definition} onChange={event => updateMetric(index, { definition: event.target.value })} placeholder="Business definition, population and exclusions. Do not enter executable SQL." /></label><button type="button" className="remove-config" aria-label={`Remove metric ${index + 1}`} onClick={() => onChange({ ...value, metrics: value.metrics.filter((_, i) => i !== index) })}><Trash2 size={14} />Remove metric</button></fieldset>)}
      <label>Data caveats and aggregation restrictions<textarea rows={3} maxLength={3000} value={value.caveats} onChange={event => onChange({ ...value, caveats: event.target.value })} placeholder="Do not sum snapshot balances across dates. Rates need their original numerator and denominator." /></label>
    </>}
  </fieldset>
}
