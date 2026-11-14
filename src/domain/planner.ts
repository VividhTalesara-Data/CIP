import { selectSources } from './sources.ts'
import type { Capability, Metric, Plan, Planner, ProfileId, Scenario } from './types.ts'

const metrics: { metric: Metric; terms: RegExp; capabilities: Capability[] }[] = [
  { metric: 'conversion', terms: /conver(?:sion|ting)|completion|funnel|friction|drop.?off/i, capabilities: ['accounts', 'journeys'] },
  { metric: 'openings', terms: /open(?:ed|ing|ings)?|account growth/i, capabilities: ['accounts'] },
  { metric: 'retention', terms: /retention|attrition|churn|losing.*customer/i, capabilities: ['retention', 'customers'] },
  { metric: 'engagement', terms: /engagement|behavior|volatility|trading/i, capabilities: ['journeys'] },
  { metric: 'support', terms: /calls?|chatbot|assistant|support|contact|live.chat/i, capabilities: ['calls', 'assistant'] },
  { metric: 'campaign', terms: /campaign|marketing|acquisition/i, capabilities: ['campaigns', 'journeys', 'accounts'] },
  { metric: 'social', terms: /social|sprinklr|sentiment/i, capabilities: ['social'] },
  { metric: 'performance', terms: /perform|returns?|balances?|assets/i, capabilities: ['accounts'] },
  { metric: 'transfers', terms: /net flows?|money movement|deposits?|withdrawals?|transfers?/i, capabilities: ['money'] },
  { metric: 'appointments', terms: /appointments?/i, capabilities: ['appointments', 'accounts'] },
]

const productConcepts = [
  { name: 'Roth IRA', pattern: /roth/i }, { name: 'HSA', pattern: /\bhsa\b|health savings/i },
  { name: 'Retirement', pattern: /retirement|rollovers?|rmd|401.?k|ira/i }, { name: 'Wealth', pattern: /wealth/i },
]
const channelConcepts = [
  { name: 'Website', pattern: /web|digital|journey|conversion/i },
  { name: 'Mobile', pattern: /mobile|app\b|ios|android/i },
  { name: 'Calls', pattern: /calls?|phone/i },
  { name: 'Fidelity Assistant', pattern: /assistant|chatbot|\bfa\b/i },
  { name: 'Live chat', pattern: /live.chat/i },
  { name: 'Search', pattern: /search/i },
]

function chooseScenario(primary: Metric, products: string[], text: string, profile: ProfileId): Scenario {
  if (primary === 'conversion' && (products.includes('Retirement') || (!products.length && profile === 'retirement'))) return 'conversion'
  if (primary === 'openings' && products.includes('Roth IRA')) return 'roth'
  if (primary === 'openings' && products.includes('HSA')) return 'hsa'
  if (primary === 'engagement' && /market|volatility|trading/i.test(text)) return 'volatility'
  if (primary === 'retention' && (products.includes('Retirement') || (!products.length && profile === 'retirement'))) return 'retention'
  if (primary === 'support' && /rollover/i.test(text)) return 'rollovers'
  return 'unsupported'
}

export const demoPlanner: Planner = {
  plan(rawQuestion, profile, previous) {
    const question = rawQuestion.trim()
    if (!question) throw new Error('Enter a question to start an investigation.')
    if (question.length > 2000) throw new Error('Please keep your question under 2,000 characters.')
    const followUp = previous && /^(break|compare|show|what|which|explain|check|look|tell|how|and)\b/i.test(question)
    const hasProduct = productConcepts.some(item => item.pattern.test(question))
    const hasNewMetric = metrics.some(item => item.terms.test(question))
    const inherit = Boolean(followUp && !hasProduct && (!hasNewMetric || /device|channel|source|evidence|alternative|release|customer signals|support signal|affected|limitation|segment|these accounts/i.test(question)))
    const analysisText = inherit && previous ? `${previous.question}. ${question}` : question
    let matched = metrics.filter(item => item.terms.test(analysisText))
    if (matched.some(item => item.metric === 'conversion')) matched = matched.filter(item => item.metric !== 'openings')
    if (matched.some(item => item.metric === 'campaign')) matched = [...matched.filter(item => item.metric === 'campaign'), ...matched.filter(item => item.metric !== 'campaign')]
    const primary = matched[0]?.metric ?? 'unknown'
    const products = productConcepts.filter(item => item.pattern.test(analysisText)).map(item => item.name)
    const channels = channelConcepts.filter(item => item.pattern.test(analysisText)).map(item => item.name)
    const diagnostic = /why|driv|declin|lower|what.*going on|what.*behind|affect|friction/i.test(analysisText)
    const capabilities = new Set<Capability>(matched.flatMap(item => item.capabilities))
    if (/market|volatility|trading/i.test(analysisText)) {
      capabilities.add('market'); capabilities.add('trading'); capabilities.add('customers')
    }
    if (channels.includes('Mobile')) capabilities.add('mobile')
    if (channels.includes('Live chat')) capabilities.add('chat')
    if (channels.includes('Search')) capabilities.add('search')
    if (/rmd|contributions?|distributions?|rollovers?/i.test(analysisText)) capabilities.add('retirement')
    if (/release|deploy|feature.flag/i.test(analysisText)) capabilities.add('releases')
    if (/incident|outage/i.test(analysisText)) capabilities.add('incidents')
    if (/policy|policies|announcement/i.test(analysisText)) capabilities.add('policies')
    if (primary === 'social' && /latest|recent|now|today|fresh/i.test(analysisText)) capabilities.add('social-live')
    if (!capabilities.size && products.length) capabilities.add('accounts')
    let scenario = chooseScenario(primary, products, analysisText, profile)
    if (inherit && previous) scenario = previous.scenario
    const countPeriod = scenario === 'roth' || scenario === 'hsa'
    const years = [...analysisText.matchAll(/\b20\d{2}\b/g)].map(match => Number(match[0]))
    const customPeriod = /last month|this month|today|yesterday|last week|this week|last quarter|\bq[1-4]\b|past \d+|last \d+|full.year|202[0-4]|202[7-9]/i.test(analysisText) || years.some(year => year !== 2026 && year !== 2025) || (years.includes(2025) && !years.includes(2026)) || (!countPeriod && /this year|year.to.date|\bytd\b/i.test(analysisText))
    const unsupportedModifier = /funded|forecast|predict|causal effect|caused|individual|customer names?|specific customer|\btop \d+|\bby (?:state|age|gender|income|region)\b|\b(?:california|texas|florida|new york|europe|asia)\b|older than|younger than|under \d+|over \d+/i.test(analysisText)
    const unsupportedCountBreakdown = countPeriod && /\bby\b|\bbreak.?down\b|\bwho\b|\bwhich customers\b|\b(?:among|where|with a|without)\b/i.test(analysisText)
    const unsupportedScope = /\b(?:in|for|among|during|since|between)\s+(?!(?:the\s+)?(?:retirement|wealth|hsa|roth|account|comparison|selected|current|prior|equivalent|same|each|both|my|our|this|last|2026|2025|ytd)\b)/i.test(analysisText)
    const countConflict = countPeriod && (matched.some(item => !['openings'].includes(item.metric)) || /rollover|rmd|contribution|conversion|401.?k|wealth/i.test(analysisText))
    const multiProduct = products.includes('HSA') && products.includes('Roth IRA')
    const lastYearOnly = /last year/i.test(analysisText) && !/this year|versus|compared|compare|vs\.?/i.test(analysisText)
    let limitation: string | undefined
    if (customPeriod || (years.length > 0 && !countPeriod) || lastYearOnly) {
      limitation = 'The requested dates are not covered by the demo fixtures. The proposed sources are shown, but no results have been invented or relabeled.'
      scenario = 'unsupported'
    } else if (unsupportedModifier || unsupportedCountBreakdown || unsupportedScope || countConflict || multiProduct) {
      limitation = 'This question needs a population, metric or breakdown not represented in the demo evidence. Connect approved data to execute the proposed investigation.'
      scenario = 'unsupported'
    } else if (scenario === 'unsupported') {
      limitation = 'This question is outside the available synthetic scenarios. This is a proposed source plan, not an executed enterprise query.'
    }
    const period = countPeriod && scenario !== 'unsupported' ? 'Jan 1 - Nov 12, 2026' : 'Oct 26 - Nov 8, 2026'
    const comparison = countPeriod && scenario !== 'unsupported' ? 'Jan 1 - Nov 12, 2025' : 'Oct 12 - Oct 25, 2026'
    const context: Plan['context'] = {
      intent: diagnostic ? 'diagnostic' : /compare|versus|trend|last year/i.test(analysisText) ? 'comparative' : primary === 'unknown' ? 'exploratory' : 'descriptive',
      metrics: matched.length ? matched.map(item => item.metric) : ['unknown'],
      products, channels, entities: /household/i.test(analysisText) ? ['households'] : /account/i.test(analysisText) ? ['accounts'] : ['customer cohorts'],
      profile, requestedPeriod: customPeriod || lastYearOnly ? question : period,
    }
    const scope = products.length ? products.join(' / ') : profile === 'retirement' ? 'Retirement' : primary === 'engagement' ? 'Brokerage customer cohorts' : 'Selected business context'
    return {
      question, context, scenario, sources: selectSources(capabilities), scope,
      period: scenario === 'unsupported' ? 'Requested period requires validation' : period,
      comparison: scenario === 'unsupported' ? 'Comparison to be confirmed' : comparison,
      assumptions: [
        'Synthetic snapshot: November 12, 2026. All dates in UTC.',
        scenario === 'unsupported' ? 'Dates, definitions and population need validation before executing a live query.' : countPeriod ? 'Equivalent elapsed calendar-year periods; distinct account openings, not funded accounts.' : 'Two equal 14-day windows; aggregate cohort comparisons unless otherwise stated.',
        ...(inherit ? ['Reusing compatible evidence from the preceding question; any new source work is shown.'] : []),
        'Profile guides suggestions, not authorization. Demo contains no personal customer data.',
      ],
      limitation,
      clarification: primary === 'performance' && /perform/i.test(analysisText) && !/returns|assets|balance|flows/i.test(analysisText)
        ? 'By performance, do you mean investment returns, balances, account openings, or customer retention?' : undefined,
    }
  },
}
