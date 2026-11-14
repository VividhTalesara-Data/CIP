import { DEMO_AS_OF } from './sources.ts'
import type { Capability, Connector, Evidence, Plan, SourceId } from './types.ts'

function evidence(sourceId: SourceId, plan: Plan, title: string, finding: string, values: Record<string, number>, options: Partial<Pick<Evidence, 'rows' | 'unit' | 'signals' | 'definition' | 'grain' | 'caveat'>> = {}): Evidence {
  return {
    id: `${plan.scenario}:${sourceId}`, sourceId, title, finding, values,
    rows: [], unit: 'count', signals: [], definition: 'Aggregate synthetic observations; no real enterprise query executed.',
    grain: 'Aggregate cohort / reporting window', caveat: 'Synthetic demonstration, not a business finding.',
    period: plan.period, comparison: plan.comparison, retrievedAt: DEMO_AS_OF, synthetic: true, ...options,
  }
}

export function getFixture(sourceId: SourceId, plan: Plan): Evidence | null {
  if (plan.scenario === 'unsupported') return null
  const make = (title: string, finding: string, values: Record<string, number>, options: Parameters<typeof evidence>[5] = {}) => evidence(sourceId, plan, title, finding, values, options)
  if (plan.scenario === 'conversion') {
    switch (sourceId) {
      case 'accounts': return make('Conversion declined by 8 percentage points', 'Opened accounts fell from 6,400 to 5,600 across 10,000 eligible journey starts in each window.', { baselineStarts: 10000, currentStarts: 10000, baselineOpened: 6400, currentOpened: 5600, baselineRate: 64, currentRate: 56 }, {
        definition: 'Conversion = distinct completed account-opening journeys / distinct eligible journey starts. An opened account is not necessarily funded.',
        grain: 'Distinct eligible account-opening journey', unit: '%',
        rows: [{ label: 'Oct 26-Nov 1', baseline: 64, current: 55 }, { label: 'Nov 2-8', baseline: 64, current: 57 }],
      })
      case 'journeys': return make('The break is at identity verification', 'Mobile web conversion fell from 60% to 44%; desktop and native app conversion remained stable.', { mobileBaseline: 60, mobileCurrent: 44, mobileStarts: 5000, desktopStarts: 3000, appStarts: 2000 }, {
        definition: 'Completed / eligible starts by channel. Mobile web: 3,000 -> 2,200; desktop: 2,100 -> 2,100; native app: 1,300 -> 1,300.',
        grain: 'Distinct journey, deduplicated by journey_id', unit: '%',
        rows: [{ label: 'Mobile web', baseline: 60, current: 44 }, { label: 'Desktop', baseline: 70, current: 70 }, { label: 'Native app', baseline: 65, current: 65 }],
        signals: ['releases', 'incidents', 'mobile', 'calls', 'assistant', 'chat', 'search', 'customers'],
      })
      case 'releases': return make('A release aligns with elevated verification errors', 'Release web-26.10.26 changed the verification component. Error rate rose from 1.2% to 7.8% in exposed mobile-web sessions.', { baselineError: 1.2, currentError: 7.8, exposedConversion: 44, unexposedConversion: 64 }, {
        definition: 'Verification failures / verification attempts; release exposure from session feature flags. Exposure cohorts are observational, not randomized.',
        grain: 'Session / release exposure', unit: '%', signals: ['campaigns', 'policies', 'market'],
        caveat: 'Timing and cohort association do not establish causality. Device and acquisition mix may confound exposure comparisons.',
      })
      case 'incidents': return make('The same service appears in an incident', 'Synthetic incident DEMO-1042 records verification timeouts beginning October 26. The incident links the identity service to a deployment change.', { relevantIncidents: 1 }, { grain: 'Incident / affected service', caveat: 'Aggregate service and time alignment; incident records are not joined to individual customers.' })
      case 'mobile': return make('Native app completion is stable', 'Native app conversion is 65% in both periods, across 2,000 eligible starts per period.', { baselineRate: 65, currentRate: 65, starts: 2000 }, { unit: '%' })
      case 'calls': return make('Verification-related calls increased', 'Identity-verification contact volume increased from 120 to 310 calls.', { baseline: 120, current: 310 }, { signals: [], grain: 'Distinct call interaction; repeat callers are not deduplicated as customers' })
      case 'assistant': return make('The chatbot shows the same friction', 'Fidelity Assistant conversations about being unable to verify identity increased from 80 to 240.', { baseline: 80, current: 240 }, { grain: 'Distinct chatbot conversation', caveat: 'Conversation counts are not unique customer counts. No causal inference from cross-channel volumes.' })
      case 'chat': return make('Live chat corroborates the verification theme', 'Verification-related live chats increased from 45 to 110.', { baseline: 45, current: 110 }, { grain: 'Distinct live-chat interaction' })
      case 'search': return make('Help-seeking shifted toward verification', 'Search sessions containing verification-help intent increased from 200 to 520.', { baseline: 200, current: 520 }, { grain: 'Distinct search session' })
      case 'customers': return make('The affected population is mobile-web applicants', 'The fixture supports an aggregate channel breakdown, not age, income or individual-customer attribution.', { mobileShare: 50 }, { unit: '%', caveat: 'No person-level support-to-journey joins are available in this fixture.' })
      case 'campaigns': return make('Acquisition mix is stable in the fixture', 'Paid campaign share is 30% in both periods. The campaign calendar records no launch in the affected period.', { baselinePaidShare: 30, currentPaidShare: 30, launches: 0 }, { unit: '%', caveat: 'A stable channel mix does not rule out unmeasured campaign or audience differences.' })
      case 'policies': return null
      case 'market': return make('Market context does not isolate a cause', 'The selected historical window contains market variation, but no fixture supports attributing the channel-specific conversion decline to it.', { observations: 28 }, { caveat: 'Seasonality and broader market explanations remain untested; no current headlines were substituted.' })
      default: return null
    }
  }
  if (plan.scenario === 'roth' || plan.scenario === 'hsa') {
    if (sourceId !== 'accounts') return null
    const roth = plan.scenario === 'roth'
    const baseline = roth ? 20000 : 15000
    const current = roth ? 23600 : 17400
    return make(`${roth ? 'Roth IRA' : 'HSA'} openings increased`, `${current.toLocaleString('en-US')} accounts opened versus ${baseline.toLocaleString('en-US')} in the equivalent prior-year period.`, { baseline, current }, {
      definition: 'Count of distinct account_id with first opened_at inside each equivalent elapsed calendar-year window, filtered to product. Reopenings excluded; funding not required.',
      grain: 'Distinct account', rows: [
        { label: 'Jan-Mar', baseline: roth ? 5800 : 4200, current: roth ? 6500 : 4900 },
        { label: 'Apr-Jun', baseline: roth ? 5200 : 4100, current: roth ? 6100 : 4600 },
        { label: 'Jul-Sep', baseline: roth ? 5600 : 4300, current: roth ? 6700 : 5100 },
        { label: 'Oct-Nov 12', baseline: roth ? 3400 : 2400, current: roth ? 4300 : 2800 },
      ],
    })
  }
  if (plan.scenario === 'volatility') {
    switch (sourceId) {
      case 'market': return make('Volatility was higher in the selected window', 'The synthetic average volatility index increased from 18 to 27 across equal historical windows.', { baseline: 18, current: 27 }, { unit: 'index points', signals: ['calls', 'assistant'], caveat: 'Synthetic market observations, not live prices or news.' })
      case 'trading': return make('Trading activity increased', 'Executed trades rose from 40,000 to 52,000 across an unchanged cohort of 10,000 customers.', { baseline: 40000, current: 52000, customers: 10000 }, {
        grain: 'Executed trade / fixed customer cohort', rows: [{ label: 'Equities', baseline: 24000, current: 32000 }, { label: 'ETFs', baseline: 12000, current: 16000 }, { label: 'Other', baseline: 4000, current: 4000 }],
      })
      case 'journeys': return make('Digital activity rose alongside trading', 'Engaged web sessions increased from 20,000 to 26,000. Sessions are not unique customers.', { baseline: 20000, current: 26000 }, { grain: 'Distinct engaged web session' })
      case 'customers': return make('The cohort is held constant', 'The comparison uses the same 10,000 brokerage customers in each window.', { baseline: 10000, current: 10000 }, { grain: 'Distinct customer in both windows' })
      case 'calls': return make('Trading-related calls also increased', 'Trading-related calls increased from 500 to 700.', { baseline: 500, current: 700 }, { grain: 'Distinct call' })
      case 'assistant': return make('More chatbot conversations concern trading', 'Fidelity Assistant trading conversations rose from 800 to 1,120.', { baseline: 800, current: 1120 }, { grain: 'Distinct conversation' })
      default: return null
    }
  }
  if (plan.scenario === 'retention') {
    switch (sourceId) {
      case 'retention': return make('Customer exits increased', 'Exits increased from 100 to 160 among 10,000 eligible customers at the start of each window.', { baselineExits: 100, currentExits: 160, eligible: 10000 }, {
        definition: 'Customer retained = at least one open retirement account at window end among customers eligible at window start. Account closure alone is not customer attrition.',
        grain: 'Distinct customer / start-of-window cohort', unit: '%', signals: ['calls', 'money'],
        rows: [{ label: 'Established', baseline: 99.4, current: 99.2 }, { label: 'New relationship', baseline: 98.6, current: 97.6 }],
      })
      case 'customers': return make('New relationships have lower retention', 'Each cohort contains 5,000 established and 5,000 new-relationship customers. Established exits: 30 to 40; new-relationship exits: 70 to 120.', { establishedBaselineExits: 30, establishedCurrentExits: 40, newBaselineExits: 70, newCurrentExits: 120 }, { caveat: 'Cohorts are independent snapshots; the fixture does not establish a causal driver.' })
      case 'calls': return make('Service friction is a candidate explanation', 'Transfer-delay calls increased from 40 to 90; person-level linkage to exits is unavailable.', { baseline: 40, current: 90 })
      case 'money': return make('Outbound transfers increased', 'Outbound transfers increased from 150 to 210. A transfer is not necessarily customer attrition.', { baseline: 150, current: 210 })
      default: return null
    }
  }
  if (plan.scenario === 'rollovers') {
    switch (sourceId) {
      case 'calls': return make('Rollover calls increased by 50%', 'Rollover-related calls rose from 400 to 600.', { baseline: 400, current: 600 }, { grain: 'Distinct call', signals: ['policies', 'search'], rows: [{ label: 'Status', baseline: 200, current: 360 }, { label: 'Eligibility', baseline: 120, current: 140 }, { label: 'Other', baseline: 80, current: 100 }] })
      case 'assistant': return make('Status questions are rising in the chatbot', 'Fidelity Assistant rollover-status conversations increased from 300 to 510.', { baseline: 300, current: 510 }, { grain: 'Distinct conversation' })
      case 'retirement': return make('Rollover volume increased more slowly', 'Rollover requests increased from 1,000 to 1,100; this does not explain the entire contact-volume increase.', { baseline: 1000, current: 1100 }, { grain: 'Distinct rollover request' })
      case 'policies': return make('A processing-message change is a hypothesis', 'A synthetic October 26 announcement changed processing-time wording; the fixture contains no experiment testing its effect.', { changes: 1 }, { caveat: 'A dated announcement and rising contacts are associated, not proof of causation.' })
      case 'search': return make('Search reinforces the status theme', 'Rollover-status search sessions rose from 250 to 410.', { baseline: 250, current: 410 }, { grain: 'Distinct search session' })
      default: return null
    }
  }
  return null
}

export interface DemoOptions {
  latency: boolean
  failSource?: SourceId
}

function waitForConnector(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Investigation cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, milliseconds)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function createDemoConnector(options: DemoOptions): Connector {
  return {
    async retrieve({ source, plan, signal, onActivity }) {
      signal.throwIfAborted()
      onActivity?.('retrieving', 'Connecting simulated tool')
      if (options.latency) await waitForConnector(600 + source.id.length * 25, signal)
      signal.throwIfAborted()
      if (source.id === options.failSource) throw new Error(`Simulated ${source.platform} connector failure. Successful evidence is preserved; retry to restore this demo source.`)
      onActivity?.('retrieving', `Pulling ${source.collections[0]}`)
      if (options.latency) await waitForConnector(1300 + source.id.length * 40, signal)
      const result = getFixture(source.id, plan)
      onActivity?.('analyzing', 'Reconciling synthetic evidence')
      if (options.latency) await waitForConnector(700 + source.id.length * 15, signal)
      signal.throwIfAborted()
      return result
    },
  }
}

export function discoveryCapabilities(item: Evidence): Capability[] {
  return item.signals
}
