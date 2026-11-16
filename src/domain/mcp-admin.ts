import { demoUsers } from './access.ts'
import type { DemoUser } from './access.ts'
import { configText, identifier, isRecord, isStrings } from './config-validation.ts'
import { mcpTemplates } from './connector-catalog.ts'
import { sourceCapabilities, sources } from './sources.ts'
import { installSourceRegistrations, readSourceRegistrations } from './source-admin.ts'
import type { SourceRegistration } from './source-admin.ts'
import type { Capability, McpSourceId } from './types.ts'

export interface McpDraft {
  templateId: string
  name: string
  description: string
  transport: 'streamable-http' | 'stdio'
  endpoint: string
  command: string
  args: string[]
  toolNames: string[]
  capabilities: Capability[]
  allowedUserIds: string[]
}
export interface McpRegistration extends McpDraft { id: McpSourceId }
export const mcpRegistryStorageKey = 'clarity:mcp-registry:v1'
const isCapability = (value: unknown): value is Capability => sourceCapabilities.some(capability => capability === value)
const isMcpId = (value: unknown): value is McpSourceId =>
  typeof value === 'string' && /^mcp:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)

function validateDraft(value: unknown): McpDraft {
  if (!isRecord(value) || typeof value.templateId !== 'string' || !mcpTemplates.some(item => item.id === value.templateId) ||
    (value.transport !== 'streamable-http' && value.transport !== 'stdio') ||
    !isStrings(value.args) || !isStrings(value.toolNames) || !isStrings(value.allowedUserIds) ||
    !Array.isArray(value.capabilities) || !value.capabilities.length || !value.capabilities.every(isCapability)) {
    throw new Error('Choose an MCP template, transport, and at least one capability; server configuration must use the expected format.')
  }
  let endpoint = ''
  let command = ''
  let args: string[] = []
  if (value.transport === 'streamable-http') {
    const url = new URL(configText(value.endpoint, 'MCP endpoint', 1000))
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash) {
      throw new Error('Use HTTPS (or local HTTP) without credentials, query parameters or fragments. Tokens belong on a secure backend.')
    }
    endpoint = url.href
  } else {
    command = configText(value.command, 'Server executable', 200)
    if (!/^[a-zA-Z0-9_./-]+$/.test(command)) throw new Error('Enter an executable name or path, not a shell command.')
    if (value.args.length > 30 || value.args.some(arg => arg.length > 300 || arg.includes('\0'))) throw new Error('Use at most 30 non-secret server arguments of 300 characters each.')
    args = [...value.args]
  }
  if (value.toolNames.length > 100 || value.toolNames.some(tool => !identifier.test(tool) || tool.length > 100)) throw new Error('Declared tool names must be valid identifiers; no tools are discovered in this demo.')
  if (value.allowedUserIds.some(id => !demoUsers.some(user => user.id === id))) throw new Error('MCP access includes an unknown demo user.')
  return {
    templateId: value.templateId, name: configText(value.name, 'Server name', 100), description: configText(value.description, 'Server purpose', 600),
    transport: value.transport, endpoint, command, args, toolNames: [...new Set(value.toolNames)],
    capabilities: [...new Set(value.capabilities)], allowedUserIds: [...new Set(value.allowedUserIds)],
  }
}

function validateRegistrations(values: unknown[]): McpRegistration[] {
  const names = new Set<string>()
  const ids = new Set<string>()
  return values.map(value => {
    if (!isRecord(value) || !isMcpId(value.id)) throw new Error('The saved MCP server identifier is invalid.')
    const draft = validateDraft(value)
    if (names.has(draft.name.toLowerCase()) || ids.has(value.id)) throw new Error('An MCP server with this name or identifier already exists.')
    names.add(draft.name.toLowerCase()); ids.add(value.id)
    return { ...draft, id: value.id }
  })
}

export function readMcpRegistrations(storage: Pick<Storage, 'getItem'>): McpRegistration[] {
  const raw = storage.getItem(mcpRegistryStorageKey)
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.servers)) throw new Error('The saved MCP registry is damaged or unsupported.')
  return validateRegistrations(value.servers)
}

export function installMcpRegistrations(registrations: McpRegistration[]) {
  const validated = validateRegistrations(registrations)
  for (const source of Object.values(sources)) if (source.id.startsWith('mcp:')) delete sources[source.id]
  for (const server of validated) sources[server.id] = {
    id: server.id, name: server.name, platform: 'MCP', connectionKind: 'mcp', providerId: server.templateId,
    description: server.description, capabilities: server.capabilities, domains: ['mcp-tools'],
    collections: server.toolNames.length ? server.toolNames : ['Tool discovery required'], joinKeys: [], timeField: 'Not applicable',
    freshness: 'Not connected; tools have not been discovered or executed.', handler: 'unconfigured',
    connectionKey: `MCP_${server.id.slice(4).replaceAll('-', '_').toUpperCase()}`,
    access: 'Admin and explicitly granted demo users only. Declared tools require server-side verification and authorization.',
    allowedUserIds: server.allowedUserIds,
  }
}

export function saveMcpServer(storage: Pick<Storage, 'getItem' | 'setItem'>, user: DemoUser, draft: McpDraft, existingId?: McpSourceId) {
  if (!user.isAdmin) throw new Error('Only an Admin demo user may configure MCP servers.')
  const input = validateDraft(draft)
  const current = readMcpRegistrations(storage)
  if (existingId && !current.some(server => server.id === existingId)) throw new Error('This MCP server no longer exists. Reload the workspace.')
  const server: McpRegistration = { ...input, id: existingId ?? `mcp:${crypto.randomUUID()}` }
  const servers = validateRegistrations(existingId ? current.map(item => item.id === existingId ? server : item) : [...current, server])
  storage.setItem(mcpRegistryStorageKey, JSON.stringify({ version: 1, servers }))
  installMcpRegistrations(servers)
  return { server, servers }
}

export function loadConnections(storage: () => Pick<Storage, 'getItem'>): { registrations: SourceRegistration[]; servers: McpRegistration[]; error: string } {
  try {
    const target = storage()
    const registrations = readSourceRegistrations(target)
    const servers = readMcpRegistrations(target)
    installSourceRegistrations(registrations)
    installMcpRegistrations(servers)
    return { registrations, servers, error: '' }
  } catch (cause) {
    return { registrations: [], servers: [], error: `Connection registry could not load. ${cause instanceof Error ? cause.message : 'Check browser storage permissions.'}` }
  }
}
