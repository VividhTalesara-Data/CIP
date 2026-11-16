import { sources } from './sources.ts'
import type { AccessSummary, Plan, ProfileId, Scenario, SourceId } from './types.ts'

export interface DemoUser {
  id: string
  name: string
  role: string
  profile: ProfileId
  scenarios: readonly Scenario[]
  products: readonly string[]
  sources: readonly SourceId[]
  isAdmin?: boolean
}

export const demoUsers: readonly DemoUser[] = [
  {
    id: 'demo-executive', name: 'Executive demo', role: 'All built-in demo business scopes and sources', profile: 'retirement',
    scenarios: ['conversion', 'roth', 'hsa', 'retention', 'rollovers', 'volatility'],
    products: ['Retirement', 'Roth IRA', 'HSA', 'Wealth'], sources: Object.values(sources).map(source => source.id),
  },
  {
    id: 'demo-digital', name: 'Digital analyst demo', role: 'Conversion and HSA; no customer conversations', profile: 'digital',
    scenarios: ['conversion', 'hsa'], products: ['Retirement', 'HSA'],
    sources: ['accounts', 'journeys', 'mobile', 'releases', 'incidents', 'campaigns', 'search'],
  },
  {
    id: 'demo-retirement', name: 'Retirement leader demo', role: 'Retirement aggregates; no transcripts or runtime data', profile: 'retirement',
    scenarios: ['conversion', 'roth', 'retention', 'rollovers'], products: ['Retirement', 'Roth IRA'],
    sources: ['accounts', 'journeys', 'mobile', 'customers', 'retention', 'retirement', 'money', 'campaigns', 'policies', 'search'],
  },
  {
    id: 'demo-service', name: 'Service analyst demo', role: 'Rollover engagement; no account or trading data', profile: 'service',
    scenarios: ['rollovers'], products: ['Retirement'],
    sources: ['calls', 'assistant', 'chat', 'search', 'retirement', 'policies'],
  },
  {
    id: 'demo-admin', name: 'Admin demo', role: 'Source administration and all demo sources', profile: 'retirement', isAdmin: true,
    scenarios: ['conversion', 'roth', 'hsa', 'retention', 'rollovers', 'volatility'],
    products: ['Retirement', 'Roth IRA', 'HSA', 'Wealth'], sources: Object.values(sources).map(source => source.id),
  },
]

export function canUseSource(user: DemoUser, sourceId: SourceId) {
  if (!Object.hasOwn(sources, sourceId)) return false
  if (user.isAdmin) return true
  const source = sources[sourceId]
  return source.handler === 'unconfigured' ? Boolean(source.allowedUserIds?.includes(user.id)) : user.sources.includes(sourceId)
}

export function authorizePlan(plan: Plan, user: DemoUser): AccessSummary {
  const excludedSourceIds = plan.sources.filter(id => !canUseSource(user, id))
  const excludedSourceCount = excludedSourceIds.length
  const denied = (message: string): AccessSummary => ({ principalId: user.id, status: 'denied', excludedSourceCount, excludedSourceIds, message })
  if (!user.scenarios.length || (plan.scenario !== 'unsupported' && !user.scenarios.includes(plan.scenario)) ||
    plan.context.products.some(product => !user.products.includes(product))) {
    return denied('This question is outside the permitted business scope for this demo user. Changing the business perspective does not grant access.')
  }
  const requested = /assistant evidence/i.test(plan.question) ? ['assistant']
    : /transcript|conversation snippets?|conversation excerpts?/i.test(plan.question) ? ['calls', 'assistant', 'chat']
      : /market (?:summary|context)/i.test(plan.question) ? ['market'] : []
  if (requested.length && !requested.some(id => user.sources.some(source => source === id))) {
    return denied('Your demo user is not permitted to access the evidence requested by this question.')
  }
  if (plan.sources.length && excludedSourceCount === plan.sources.length) {
    return denied('None of the required demo sources is permitted for this user. No answer or source query will be produced.')
  }
  return {
    principalId: user.id, status: excludedSourceCount ? 'partial' : 'allowed', excludedSourceCount, excludedSourceIds,
    message: excludedSourceCount ? 'Some requested sources are not permitted. Any answer must use authorized evidence only and may be incomplete.' : 'Only the permitted scopes and sources for this demo user may be used.',
  }
}
