import { useState } from 'react'
import { ArrowRight, BookOpen, Database, Network, Plus, Search, ShieldCheck } from 'lucide-react'
import { dataConnectors, mcpTemplates } from '../domain/connector-catalog.ts'
import type { SourceRegistration } from '../domain/source-admin.ts'
import type { McpRegistration } from '../domain/mcp-admin.ts'
import ConnectorIcon from './ConnectorIcon.tsx'

export default function AdminWorkspace({ registrations, servers, onData, onContext, onMcp, onPreview }: {
  registrations: SourceRegistration[]; servers: McpRegistration[]
  onData: (providerId: string) => void; onContext: (source: SourceRegistration) => void
  onMcp: (templateId: string, server?: McpRegistration) => void; onPreview: () => void
}) {
  const [module, setModule] = useState<'data' | 'context' | 'mcp'>('data')
  const [search, setSearch] = useState('')
  const catalog = module === 'mcp' ? mcpTemplates : dataConnectors
  const filtered = catalog.filter(item => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(search.toLowerCase()))
  const documented = registrations.filter(source => source.semanticContext).length
  return <div className="admin-workspace">
    <div className="admin-hero"><div><span className="admin-eyebrow">CLARITY / ADMINISTRATION</span><h1>Workspace administration</h1><p>Manage data connections, business context and agent tools in one place.</p></div><button className="admin-preview" onClick={onPreview}>Preview user portal<ArrowRight size={16} /></button></div>
    <div className="admin-modules" role="group" aria-label="Administration modules">
      <button aria-pressed={module === 'data'} aria-label="Data connections" onClick={() => { setModule('data'); setSearch('') }}><Database size={23} /><strong>Data connections</strong><span>{registrations.length} configured · {dataConnectors.length} templates</span><small>Databases, warehouses and cloud services</small></button>
      <button aria-pressed={module === 'context'} aria-label="Data context" onClick={() => { setModule('context'); setSearch('') }}><BookOpen size={23} /><strong>Data context</strong><span>{documented} of {registrations.length} sources documented</span><small>Business meaning, fields and aggregation rules</small></button>
      <button aria-pressed={module === 'mcp'} aria-label="MCP tools" onClick={() => { setModule('mcp'); setSearch('') }}><Network size={23} /><strong>MCP tools</strong><span>{servers.length} configured · Custom servers supported</span><small>Tool server transports, capabilities and grants</small></button>
    </div>
    <div className="admin-demo-notice"><ShieldCheck size={17} /><span><strong>Configuration demo.</strong> Saved connections remain not connected. No credentials, real data, schemas or tool manifests are fetched, and no commands or tools run.</span></div>
    {module === 'context' ? <section className="admin-module-content"><div className="admin-section-heading"><div><h2>Make the data understandable</h2><p>Define grain, field meaning, metric mappings and approved aggregations. The agent receives only the mappings relevant to a question; missing rules are not guessed.</p></div></div>
      {!registrations.length && <div className="admin-empty"><BookOpen size={28} /><h3>Start with a data connection</h3><p>Then add its field definitions and metric rules here.</p><button onClick={() => setModule('data')}>Browse data connectors<ArrowRight size={15} /></button></div>}
      <div className="admin-configured-grid">{registrations.map(source => <article key={source.id}><span className="source-connection-status">{source.semanticContext ? 'Context documented' : 'Needs data context'}</span><h3>{source.name}</h3><p>{source.semanticContext?.grain ?? 'Dataset grain and field semantics are not documented yet.'}</p><small>{source.semanticContext?.fields.length ?? 0} fields · {source.semanticContext?.metrics.length ?? 0} metric mappings</small><button onClick={() => onContext(source)}>Edit data context<ArrowRight size={15} /></button></article>)}</div>
    </section> : <section className="admin-module-content">
      <div className="admin-section-heading"><div><h2>{module === 'data' ? 'Choose a data connector' : 'Connect an MCP tool server'}</h2><p>{module === 'data' ? 'Select a platform, register its datasets and access grants, then describe its business context.' : 'Common configuration templates plus Custom for any compatible server. These are not verified vendor-hosted endpoints or an exhaustive server directory.'}</p></div><label className="connector-search"><Search size={16} /><span className="sr-only">Search {module === 'data' ? 'data connectors' : 'MCP templates'}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search connections..." /></label></div>
      <div className="connector-catalog">{filtered.map(template => <button className="connector-card" key={template.id} aria-label={`${module === 'data' ? 'Connect' : 'Configure'} ${template.name}`} onClick={() => module === 'data' ? onData(template.id) : onMcp(template.id)}><ConnectorIcon template={template} /><span className="connector-category">{template.category}</span><strong>{template.name}</strong><span>{template.description}</span><small><Plus size={13} />{module === 'data' ? 'Add connection' : 'Configure server'}</small></button>)}</div>
      {!filtered.length && <p className="muted">No templates match. Use Other data source or Custom MCP server for another provider.</p>}
      <div className="admin-section-heading"><div><h2>{module === 'data' ? 'Your configured data sources' : 'Your configured MCP servers'}</h2><p>Configuration saved locally. Live connection and discovery require a secure backend.</p></div></div>
      <div className="admin-configured-grid">{module === 'data' ? registrations.map(source => <article key={source.id}><span className="source-connection-status">Not connected</span><h3>{source.name}</h3><p>{source.platform}</p><small>{source.semanticContext ? `${source.semanticContext.fields.length} documented fields` : 'Data context needed'}</small><button onClick={() => onContext(source)}>Manage connection<ArrowRight size={15} /></button></article>) : servers.map(server => <article key={server.id}><span className="source-connection-status">Not connected</span><h3>{server.name}</h3><p>{server.transport === 'stdio' ? 'stdio · Backend process required' : 'Streamable HTTP'}</p><small>{server.toolNames.length} declared tool names · Discovery not run</small><button onClick={() => onMcp(server.templateId, server)}>Manage MCP server<ArrowRight size={15} /></button></article>)}</div>
      {!(module === 'data' ? registrations.length : servers.length) && <p className="muted">No configurations yet. Choose a template above to get started.</p>}
    </section>}
  </div>
}
