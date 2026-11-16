import { demoUsers } from './access.ts'
import type { DemoUser } from './access.ts'
import { sourceCapabilities, sources } from './sources.ts'
import type { Capability, CustomSourceId, SemanticContext, SourceDefinition } from './types.ts'
import { identifier, isRecord, isStrings } from './config-validation.ts'
import { connectorSettings, dataConnectors } from './connector-catalog.ts'
import { validateSemanticContext } from './semantics.ts'

export interface SourceDraft {
  name: string
  platform: string
  description: string
  capabilities: Capability[]
  collections: string[]
  joinKeys: string[]
  timeField: string
  allowedUserIds: string[]
  providerId?: string
  semanticContext?: SemanticContext
  connectionProperties?: Record<string, string>
}

export interface SourceRegistration extends SourceDraft { id: CustomSourceId }
export const sourceRegistryStorageKey = 'clarity:source-registry:v1'

const isCapability = (value: unknown): value is Capability => sourceCapabilities.some(capability => capability === value)
const isCustomId = (value: unknown): value is CustomSourceId =>
  typeof value === 'string' && /^custom:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)

function validateDraft(value: unknown): SourceDraft {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.platform !== 'string' ||
    typeof value.description !== 'string' || typeof value.timeField !== 'string' ||
    !Array.isArray(value.capabilities) || !value.capabilities.every(isCapability) ||
    !isStrings(value.collections) || !isStrings(value.joinKeys) || !isStrings(value.allowedUserIds)) {
    throw new Error('Source configuration has an invalid format.')
  }
  const name = value.name.trim()
  const platform = value.platform.trim()
  const description = value.description.trim()
  const timeField = value.timeField.trim()
  if (!name || name.length > 100) throw new Error('Enter a source name between 1 and 100 characters.')
  if (!platform || platform.length > 60) throw new Error('Enter a platform name between 1 and 60 characters.')
  if (!description || description.length > 600) throw new Error('Enter a source description between 1 and 600 characters.')
  if (!value.capabilities.length) throw new Error('Select at least one capability so the planner can find this source.')
  const collections = [...new Set(value.collections.map(item => item.trim()))]
  const joinKeys = [...new Set(value.joinKeys.map(item => item.trim()))]
  if (!collections.length || collections.length > 20 || collections.some(item => item.length > 100 || !identifier.test(item))) {
    throw new Error('Enter 1-20 valid collection or table identifiers, separated by commas. Do not enter URLs or credentials.')
  }
  if (!joinKeys.length || joinKeys.length > 20 || joinKeys.some(item => item.length > 100 || !identifier.test(item))) {
    throw new Error('Enter 1-20 valid candidate join-key identifiers, separated by commas.')
  }
  if (!identifier.test(timeField) || timeField.length > 100) throw new Error('Enter a valid time-field identifier.')
  if (value.allowedUserIds.some(id => !demoUsers.some(user => user.id === id))) throw new Error('Source access includes an unknown demo user.')
  const providerId = typeof value.providerId === 'string' ? value.providerId : undefined
  if (value.providerId !== undefined && !dataConnectors.some(provider => provider.id === providerId)) throw new Error('Choose a valid data connector template.')
  const provider = dataConnectors.find(item => item.id === providerId)
  if (provider && provider.id !== 'custom' && provider.name !== platform) throw new Error('The platform must match the selected connector template. Use Other data source for a custom platform.')
  let connectionProperties: Record<string, string> | undefined
  if (value.connectionProperties !== undefined) {
    if (!isRecord(value.connectionProperties)) throw new Error('Dataset location properties must be named text values.')
    const settings = connectorSettings[providerId ?? 'custom']
    connectionProperties = {}
    for (const [key, text] of Object.entries(value.connectionProperties)) {
      if (!settings.some(setting => setting.key === key) || typeof text !== 'string' || text.length > 200 || /https?:\/\/|password=|token=/i.test(text)) {
        throw new Error('Use only the selected connector location fields, with non-secret aliases rather than URLs or credentials.')
      }
      if (text.trim()) connectionProperties[key] = text.trim()
    }
  }
  return { name, platform, description, timeField, collections, joinKeys, capabilities: [...new Set(value.capabilities)], allowedUserIds: [...new Set(value.allowedUserIds)], providerId, semanticContext: validateSemanticContext(value.semanticContext, timeField), connectionProperties }
}

function validateRegistrations(values: unknown[]): SourceRegistration[] {
  const ids = new Set<string>()
  const names = new Set(Object.values(sources).filter(source => source.handler === 'demo').map(source => source.name.toLowerCase()))
  return values.map(value => {
    if (!isRecord(value) || !isCustomId(value.id)) throw new Error('Saved source configuration has an invalid source identifier.')
    const input = validateDraft(value)
    if (ids.has(value.id) || names.has(input.name.toLowerCase())) throw new Error('A source with this name or identifier already exists.')
    ids.add(value.id)
    names.add(input.name.toLowerCase())
    return { ...input, id: value.id }
  })
}

export function readSourceRegistrations(storage: Pick<Storage, 'getItem'>): SourceRegistration[] {
  const raw = storage.getItem(sourceRegistryStorageKey)
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sources)) throw new Error('The saved source registry is damaged or uses an unsupported format.')
  return validateRegistrations(value.sources)
}

function definition(registration: SourceRegistration): SourceDefinition {
  return {
    ...registration, handler: 'unconfigured', connectionKind: 'data', domains: ['admin-registered'],
    freshness: 'Not connected; no data has been retrieved.',
    access: registration.allowedUserIds.length ? 'Admin and explicitly granted demo users only; server-side authorization required for live use.' : 'Admin demo only; server-side authorization required for live use.',
    connectionKey: `CUSTOM_${registration.id.slice(7).replaceAll('-', '_').toUpperCase()}_CONNECTOR`,
  }
}

export function installSourceRegistrations(registrations: SourceRegistration[]) {
  const validated = validateRegistrations(registrations)
  for (const source of Object.values(sources)) if (source.id.startsWith('custom:')) delete sources[source.id]
  for (const registration of validated) sources[registration.id] = definition(registration)
}

export function loadSourceRegistry(storage: () => Pick<Storage, 'getItem'>): { registrations: SourceRegistration[]; error: string } {
  try {
    const registrations = readSourceRegistrations(storage())
    installSourceRegistrations(registrations)
    return { registrations, error: '' }
  } catch (cause) {
    return { registrations: [], error: `Source registry could not load. ${cause instanceof Error ? cause.message : 'Check browser storage permissions.'}` }
  }
}

export function registerSource(storage: Pick<Storage, 'getItem' | 'setItem'>, user: DemoUser, draft: SourceDraft, existingId?: CustomSourceId) {
  if (!user.isAdmin) throw new Error('Only an Admin demo user may register data sources.')
  const input = validateDraft(draft)
  const current = readSourceRegistrations(storage)
  if (existingId && !current.some(item => item.id === existingId)) throw new Error('This source no longer exists. Reload the administration workspace.')
  const registration: SourceRegistration = { ...input, id: existingId ?? `custom:${crypto.randomUUID()}` }
  const registrations = validateRegistrations(existingId ? current.map(item => item.id === existingId ? registration : item) : [...current, registration])
  storage.setItem(sourceRegistryStorageKey, JSON.stringify({ version: 1, sources: registrations }))
  installSourceRegistrations(registrations)
  return { registration, registrations }
}
