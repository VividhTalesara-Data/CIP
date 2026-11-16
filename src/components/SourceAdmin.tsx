import { useRef, useState } from 'react'
import { Database, ShieldCheck } from 'lucide-react'
import { demoUsers } from '../domain/access.ts'
import type { DemoUser } from '../domain/access.ts'
import { registerSource } from '../domain/source-admin.ts'
import type { SourceDraft, SourceRegistration } from '../domain/source-admin.ts'
import { sourceCapabilities, sources } from '../domain/sources.ts'
import { connectorSettings, dataConnectors } from '../domain/connector-catalog.ts'
import { describeSourceContext } from '../domain/semantics.ts'
import ConnectorIcon from './ConnectorIcon.tsx'
import SemanticEditor from './SemanticEditor.tsx'

const emptyDraft: SourceDraft = { name: '', platform: 'Snowflake', description: '', capabilities: [], collections: [], joinKeys: [], timeField: '', allowedUserIds: [] }
const identifiers = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)

export default function SourceAdmin({ user, registrations, onSaved, providerId = 'custom', initialSource }: {
  user: DemoUser; registrations: SourceRegistration[]; onSaved: (registrations: SourceRegistration[]) => void; providerId?: string; initialSource?: SourceRegistration
}) {
  const template = dataConnectors.find(item => item.id === (initialSource?.providerId ?? providerId))
  const [draft, setDraft] = useState<SourceDraft>(initialSource ?? { ...emptyDraft, providerId, platform: template?.id === 'custom' ? '' : template?.name ?? '' })
  const [collections, setCollections] = useState(initialSource?.collections.join(', ') ?? '')
  const [joinKeys, setJoinKeys] = useState(initialSource?.joinKeys.join(', ') ?? '')
  const [savedId, setSavedId] = useState(initialSource?.id)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saving = useRef(false)
  if (!user.isAdmin) return <p className="form-error" role="alert">Only an Admin demo user may register data sources.</p>

  return <div className="source-admin">
    {template && <div className="selected-connector"><ConnectorIcon template={template} /><div><h3>{template.name}</h3><p>Data connection configuration · Not connected</p></div></div>}
    <div className="notice warning"><ShieldCheck size={18} /><span><strong>Register a mapping, not a live connection.</strong> Enter demo metadata only, never credentials, endpoint URLs or real data. A server-side adapter is still required. Browser admin roles are demo controls, not production security.</span></div>
    <form className="source-admin-form" onSubmit={event => {
      event.preventDefault()
      if (saving.current) return
      saving.current = true
      setError('')
      setSuccess('')
      try {
        const result = registerSource(window.localStorage, user, { ...draft, collections: identifiers(collections), joinKeys: identifiers(joinKeys) }, savedId)
        onSaved(result.registrations)
        setSuccess(`${result.registration.name} ${savedId ? 'updated' : 'registered'}. Not connected: no queries will run until a server connector is implemented. The mapping and documented context are available in relevant plans for granted users.`)
        setDraft(result.registration)
        setSavedId(result.registration.id)
      } catch (cause) {
        setError(`${savedId ? 'Source changes were not saved.' : 'Source was not registered.'} ${cause instanceof Error ? cause.message : 'Check browser storage permissions and try again.'}`)
      } finally { saving.current = false }
    }}>
      <h3 className="section-heading">{savedId ? 'Manage data source' : 'Add a data source'}</h3>
      <div className="source-admin-grid">
        <label>Data source name<input required maxLength={100} value={draft.name} onChange={event => setDraft(item => ({ ...item, name: event.target.value }))} placeholder="Account opening audit" /></label>
        <label>Platform<input required readOnly={Boolean(template && template.id !== 'custom')} maxLength={60} value={draft.platform} onChange={event => setDraft(item => ({ ...item, platform: event.target.value }))} placeholder="Snowflake, Databricks, ServiceNow..." /></label>
      </div>
      <label>Description<textarea required maxLength={600} rows={3} value={draft.description} onChange={event => setDraft(item => ({ ...item, description: event.target.value }))} placeholder="What business evidence would this source provide? Use demo metadata only." /></label>
      <fieldset><legend>Dataset location (optional)</legend><p>Non-secret reference names only. These settings are saved as metadata; the demo does not connect or discover a schema.</p><div className="source-admin-grid">{connectorSettings[template?.id ?? 'custom'].map(setting => <label key={setting.key}>{setting.label}<input maxLength={200} value={draft.connectionProperties?.[setting.key] ?? ''} onChange={event => setDraft(item => ({ ...item, connectionProperties: { ...item.connectionProperties, [setting.key]: event.target.value } }))} placeholder={setting.placeholder} /></label>)}</div></fieldset>
      <fieldset><legend>Capabilities</legend><p>Select at least one. The planner proposes this source when a selected capability is needed; this does not add new demo analytics or invent results.</p><div className="source-checkbox-grid">{sourceCapabilities.map(capability => <label key={capability}><input type="checkbox" checked={draft.capabilities.includes(capability)} onChange={event => setDraft(item => ({ ...item, capabilities: event.target.checked ? [...item.capabilities, capability] : item.capabilities.filter(value => value !== capability) }))} />{sources[capability].name}</label>)}</div></fieldset>
      <label>Collections / tables<input required maxLength={2000} value={collections} onChange={event => setCollections(event.target.value)} placeholder="ACCOUNT_AUDIT, OPENING_EVENTS" /><small>Comma-separated identifiers. Do not enter URLs, SQL or credentials.</small></label>
      <div className="source-admin-grid">
        <label>Candidate join keys<input required maxLength={2000} value={joinKeys} onChange={event => setJoinKeys(event.target.value)} placeholder="account_id, journey_id" /></label>
        <label>Time field<input required maxLength={100} value={draft.timeField} onChange={event => setDraft(item => ({ ...item, timeField: event.target.value }))} placeholder="event_at" /></label>
      </div>
      <SemanticEditor value={draft.semanticContext} onChange={semanticContext => setDraft(item => ({ ...item, semanticContext }))} />
      <fieldset><legend>Access grants</legend><p>Admin-only by default. Grant other demo users access explicitly; their business-scope restrictions still apply.</p><div className="source-checkbox-grid">{demoUsers.filter(item => !item.isAdmin).map(item => <label key={item.id}><input type="checkbox" checked={draft.allowedUserIds.includes(item.id)} onChange={event => setDraft(current => ({ ...current, allowedUserIds: event.target.checked ? [...current.allowedUserIds, item.id] : current.allowedUserIds.filter(id => id !== item.id) }))} />{item.name}</label>)}</div></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="report-action-status" role="status">{success}</p>}
      <button className="primary-button" type="submit"><Database size={16} />{savedId ? 'Save source changes' : 'Register data source'}</button>
    </form>
    {savedId && <details className="agent-context-preview"><summary>Preview saved agent context</summary><pre>{describeSourceContext(sources[savedId])}</pre></details>}
    <h3 className="section-heading">Registered sources ({registrations.length})</h3>
    {!registrations.length && <p className="muted">No admin-added sources yet. Built-in demo sources remain unchanged.</p>}
    <div className="registered-source-list">{registrations.map(source => <article key={source.id}><strong>{source.name}</strong><span className="source-connection-status">Not connected</span><p>{source.platform} · {source.capabilities.map(capability => sources[capability].name).join(', ')}</p><p>Access: Admin{source.allowedUserIds.length ? `, ${demoUsers.filter(user => source.allowedUserIds.includes(user.id)).map(user => user.name).join(', ')}` : ' only'}</p></article>)}</div>
    <p className="muted small-copy">Mappings are stored in this browser. Start a new question or follow-up to use an added mapping; reload other tabs to refresh their library. No enterprise system was contacted.</p>
  </div>
}
