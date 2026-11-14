import type { Capability, SourceDefinition, SourceId } from './types.ts'

export const DEMO_AS_OF = '2026-11-12T23:59:59Z'

function source(id: SourceId, name: string, platform: string, description: string, collections: string[], joinKeys: string[], timeField: string, domains: string[], capabilities: Capability[] = [id]): SourceDefinition {
  return {
    id, name, platform, description, collections, joinKeys, timeField, domains, capabilities,
    freshness: DEMO_AS_OF, access: 'Server-enforced business-unit scope; read-only; aggregate results',
    handler: 'demo', connectionKey: id === 'policies' ? 'INTERNAL_NEWS_CONNECTOR' : id.toUpperCase().replace('-', '_') + '_CONNECTOR',
  }
}

// Collection names are replaceable placeholders, not verified enterprise schemas.
export const sources: Record<SourceId, SourceDefinition> = {
  accounts: source('accounts', 'Accounts & growth', 'Snowflake', 'Measure account openings, balances and performance.', ['ACCOUNT_MASTER', 'ACCOUNT_OPENINGS', 'ACCOUNT_BALANCES', 'ACCOUNT_PERFORMANCE'], ['account_id', 'customer_id'], 'opened_at', ['retirement', 'wealth', 'hsa']),
  journeys: source('journeys', 'Digital journeys', 'Snowflake', 'Locate friction across website funnel steps and sessions.', ['WEB_EVENTS', 'WEB_SESSIONS', 'DIGITAL_JOURNEY_EVENTS'], ['session_id', 'journey_id', 'account_id'], 'event_at', ['digital']),
  mobile: source('mobile', 'Mobile experience', 'Snowflake', 'Compare app versions and mobile journey outcomes.', ['MOBILE_EVENTS', 'MOBILE_SESSIONS', 'MOBILE_JOURNEY_EVENTS'], ['session_id', 'journey_id', 'app_version'], 'event_at', ['digital']),
  releases: source('releases', 'Releases & runtime', 'Splunk', 'Align deployments, feature exposure, errors and latency.', ['deployment_events', 'runtime_errors', 'feature_exposure'], ['release_version', 'session_id', 'service_id'], 'timestamp', ['technology']),
  incidents: source('incidents', 'Technical incidents', 'ServiceNow', 'Check affected services, changes and resolution records.', ['incidents', 'problems', 'change_records'], ['incident_id', 'service_id', 'change_id'], 'opened_at', ['technology']),
  calls: source('calls', 'Customer calls', 'Snowflake', 'Understand contact reasons, transfers and outcomes.', ['CALL_INTERACTIONS', 'CALL_TRANSCRIPTS', 'CALL_OUTCOMES'], ['interaction_id', 'customer_id'], 'started_at', ['service']),
  assistant: source('assistant', 'Fidelity Assistant', 'Snowflake', 'Understand chatbot conversation themes and intent outcomes.', ['FA_INTERACTIONS', 'FA_CONVERSATIONS', 'FA_INTENT_OUTCOMES'], ['conversation_id', 'customer_id'], 'started_at', ['service']),
  chat: source('chat', 'Live chat', 'Snowflake', 'Review live-chat themes and resolution outcomes.', ['LIVE_CHAT_INTERACTIONS', 'LIVE_CHAT_TRANSCRIPTS'], ['interaction_id', 'customer_id'], 'started_at', ['service']),
  search: source('search', 'Customer search', 'Snowflake', 'Identify website and app search intent and unmet needs.', ['SEARCH_QUERIES', 'SEARCH_EVENTS', 'SEARCH_OUTCOMES'], ['session_id', 'query_id'], 'searched_at', ['digital']),
  campaigns: source('campaigns', 'Campaign context', 'Confluence', 'Review launch calendars, audiences and campaign briefs.', ['campaign_briefs', 'launch_calendars', 'audience_definitions'], ['campaign_id', 'product_id'], 'effective_at', ['marketing']),
  policies: source('policies', 'Policies & announcements', 'Newsline / My GPS', 'Check relevant policy changes and effective dates.', ['internal_articles', 'policy_updates', 'announcements'], ['product_id', 'policy_id'], 'effective_at', ['policy']),
  market: source('market', 'Market context', 'Market & news', 'Retrieve timestamped market observations for the selected period.', ['market_observations', 'historical_news'], ['instrument_id', 'observed_date'], 'published_at', ['market']),
  trading: source('trading', 'Trading & holdings', 'Snowflake', 'Compare trading activity and holdings by cohort.', ['TRADES', 'HOLDINGS'], ['account_id', 'customer_id', 'instrument_id'], 'executed_at', ['wealth']),
  customers: source('customers', 'Customer context', 'Snowflake', 'Understand segments, relationships and populations.', ['CUSTOMER_PROFILES', 'CUSTOMER_SEGMENTS', 'CUSTOMER_RELATIONSHIPS'], ['customer_id', 'household_id'], 'snapshot_at', ['customer']),
  retention: source('retention', 'Customer retention', 'Snowflake', 'Measure customer-level retained and exited cohorts.', ['CUSTOMER_RETENTION'], ['customer_id', 'cohort_id'], 'cohort_end_at', ['customer']),
  money: source('money', 'Money movement', 'Snowflake', 'Separate deposits, withdrawals, transfers and net flows.', ['MONEY_MOVEMENTS', 'TRANSFER_EVENTS'], ['account_id', 'transfer_id'], 'posted_at', ['wealth', 'retirement']),
  retirement: source('retirement', 'Retirement activity', 'Snowflake', 'Analyze contributions, distributions, conversions, RMDs and rollovers.', ['RETIREMENT_CONTRIBUTIONS', 'RETIREMENT_DISTRIBUTIONS', 'ROTH_CONVERSIONS', 'ROLLOVERS'], ['account_id', 'customer_id'], 'effective_at', ['retirement', 'hsa']),
  appointments: source('appointments', 'Wealth appointments', 'Snowflake', 'Connect scheduled appointments and documented outcomes.', ['WEALTH_APPOINTMENTS', 'APPOINTMENT_OUTCOMES'], ['appointment_id', 'customer_id'], 'scheduled_at', ['wealth']),
  social: source('social', 'Social engagement', 'Snowflake', 'Review curated social interactions and deduplicated historical mentions.', ['SOCIAL_INTERACTIONS', 'SOCIAL_MENTIONS'], ['platform_post_id', 'platform'], 'published_at', ['social']),
  'social-live': source('social-live', 'Social listening', 'Sprinklr', 'Retrieve recent public themes; deduplicate by platform and post ID.', ['social_listening_mentions'], ['platform_post_id', 'platform'], 'published_at', ['social']),
}

export function selectSources(capabilities: Iterable<Capability>): SourceId[] {
  const required = new Set(capabilities)
  return Object.values(sources).filter(item => item.capabilities.some(cap => required.has(cap))).map(item => item.id)
}
