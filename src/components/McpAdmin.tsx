import { useRef, useState } from 'react'
import { Network, ShieldCheck } from 'lucide-react'
import { demoUsers } from '../domain/access.ts'
import type { DemoUser } from '../domain/access.ts'
import { mcpTemplates } from '../domain/connector-catalog.ts'
import { saveMcpServer } from '../domain/mcp-admin.ts'
import type { McpDraft, McpRegistration } from '../domain/mcp-admin.ts'
import { sourceCapabilities, sources } from '../domain/sources.ts'
import ConnectorIcon from './ConnectorIcon.tsx'

export default function McpAdmin({ user, templateId, initialServer, onSaved }: { user: DemoUser; templateId: string; initialServer?: McpRegistration; onSaved: (servers: McpRegistration[]) => void }) {
  const template = mcpTemplates.find(item => item.id === templateId)
  const [draft, setDraft] = useState<McpDraft>(initialServer ?? { templateId, name: template?.name ?? '', description: '', transport: 'streamable-http', endpoint: '', command: '', args: [], toolNames: [], capabilities: [], allowedUserIds: [] })
  const [tools, setTools] = useState(initialServer?.toolNames.join(', ') ?? '')
  const [args, setArgs] = useState(initialServer?.args.join('\n') ?? '')
  const [savedId, setSavedId] = useState(initialServer?.id)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saving = useRef(false)
  if (!user.isAdmin || !template) return <p className="form-error" role="alert">An Admin demo login and valid MCP template are required.</p>
  return <div className="source-admin">
    <div className="selected-connector"><ConnectorIcon template={template} /><div><h3>{template.name}</h3><p>MCP configuration only · Not connected</p></div></div>
    <div className="notice warning"><ShieldCheck size={18} /><span>No connection, tool discovery or command execution occurs here. Use dummy endpoint/process details, never credentials or tokens. A secure backend must verify the server, tools, grants and protocol compatibility.</span></div>
    <form className="source-admin-form" onSubmit={event => {
      event.preventDefault()
      if (saving.current) return
      saving.current = true
      setError(''); setSuccess('')
      try {
        const result = saveMcpServer(window.localStorage, user, { ...draft, toolNames: tools.split(',').map(item => item.trim()).filter(Boolean), args: args.split('\n').map(item => item.trim()).filter(Boolean) }, savedId)
        onSaved(result.servers); setSavedId(result.server.id)
        setSuccess(`${result.server.name} configuration saved. Not connected; no tools were discovered or executed.`)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'MCP configuration could not be saved.') }
      finally { saving.current = false }
    }}>
      <label>MCP server name<input required maxLength={100} value={draft.name} onChange={event => setDraft(item => ({ ...item, name: event.target.value }))} /></label>
      <label>Server purpose<textarea required rows={3} maxLength={600} value={draft.description} onChange={event => setDraft(item => ({ ...item, description: event.target.value }))} /></label>
      <label>Transport<select value={draft.transport} onChange={event => {
        if (event.target.value === 'stdio' || event.target.value === 'streamable-http') setDraft(item => ({ ...item, transport: event.target.value === 'stdio' ? 'stdio' : 'streamable-http' }))
      }}><option value="streamable-http">Streamable HTTP</option><option value="stdio">stdio (backend-managed process)</option></select></label>
      {draft.transport === 'streamable-http' ? <label>MCP endpoint<input type="url" required maxLength={1000} value={draft.endpoint} onChange={event => setDraft(item => ({ ...item, endpoint: event.target.value }))} placeholder="https://mcp.example.com/mcp" /><small>Dummy URL only. No credentials, query parameters or fragments.</small></label> : <><label>Server executable<input required value={draft.command} onChange={event => setDraft(item => ({ ...item, command: event.target.value }))} placeholder="npx" /></label><label>Arguments (one per line)<textarea rows={3} value={args} onChange={event => setArgs(event.target.value)} placeholder="Non-secret arguments only; never executed in this demo" /></label></>}
      <label>Declared tool names<input value={tools} onChange={event => setTools(event.target.value)} placeholder="search_documents, get_issue" /><small>Optional names to verify against the server manifest later. These are not discovered or callable tools.</small></label>
      <fieldset><legend>Planning capabilities</legend><p>Select what this server could contribute to an investigation. It remains a disconnected node, never an executed tool.</p><div className="source-checkbox-grid">{sourceCapabilities.map(capability => <label key={capability}><input type="checkbox" checked={draft.capabilities.includes(capability)} onChange={event => setDraft(item => ({ ...item, capabilities: event.target.checked ? [...item.capabilities, capability] : item.capabilities.filter(value => value !== capability) }))} />{sources[capability].name}</label>)}</div></fieldset>
      <fieldset><legend>Access grants</legend><p>Admin-only unless granted below. Business-scope restrictions still apply.</p><div className="source-checkbox-grid">{demoUsers.filter(item => !item.isAdmin).map(item => <label key={item.id}><input type="checkbox" checked={draft.allowedUserIds.includes(item.id)} onChange={event => setDraft(current => ({ ...current, allowedUserIds: event.target.checked ? [...current.allowedUserIds, item.id] : current.allowedUserIds.filter(id => id !== item.id) }))} />{item.name}</label>)}</div></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="report-action-status" role="status">{success}</p>}
      <button type="submit" className="primary-button"><Network size={16} />Save MCP configuration</button>
    </form>
  </div>
}
