import type { Answer, Investigation, SourceId } from './types.ts'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const change = (current: number, baseline: number) => baseline === 0 ? 'Not comparable' : `${format((current - baseline) / baseline * 100)}%`

export function generateAnswer(run: Investigation): Answer {
  const { plan, evidence, nodes } = run
  const bySource = (id: string) => evidence.find(item => item.sourceId === id)
  const errors = nodes.filter(node => node.status === 'error')
  const empty = nodes.filter(node => node.status === 'empty')
  const answer: Answer = {
    headline: 'The available evidence is incomplete.',
    summary: 'The investigation could not establish the requested result. Inspect the available sources and retry failed connectors.',
    metrics: [], findings: [],
    recommendations: [],
    limitations: ['All findings are generated from synthetic demo evidence, not live enterprise data.'],
    followUps: [],
  }
  if (plan.scenario === 'unsupported') {
    answer.headline = plan.clarification ? 'A little more context will help.' : 'A new question. A proposed path forward.'
    answer.summary = plan.clarification ?? plan.limitation ?? 'No matching demo evidence is available.'
    answer.limitations.push('The offline planner uses compositional concepts and capabilities, not a live language model. Source selection is a proposal requiring validation.')
    answer.recommendations = plan.sources.length
      ? ['Confirm the metric definition, population and reporting dates.', 'Configure authorized server-side connectors for the proposed sources. No enterprise query has been executed.']
      : ['Clarify the business metric, product and timeframe so an authorized planner can identify relevant sources.']
    answer.followUps = plan.clarification
      ? ['How many Roth IRA accounts were opened this year?', 'What is driving retirement customer attrition?']
      : ['How are HSA account openings trending this year?', 'How is market volatility affecting trading and engagement?']
    return answer
  }
  if (plan.scenario === 'conversion') {
    const accounts = bySource('accounts')
    const journeys = bySource('journeys')
    const release = bySource('releases')
    if (accounts) {
      const { baselineRate, currentRate, currentOpened, baselineOpened } = accounts.values
      answer.headline = journeys ? 'The decline is concentrated in mobile-web verification.' : 'Retirement account-opening conversion declined.'
      answer.summary = `Conversion fell from ${format(baselineRate)}% to ${format(currentRate)}% (${format(currentRate - baselineRate)} percentage points), with ${format(baselineOpened - currentOpened)} fewer openings on unchanged journey-start volume. ${release ? 'Release exposure and elevated verification errors align with the decline, but causality has not been established.' : 'The available evidence does not establish the cause.'}`
      answer.metrics.push(
        { label: 'Opening conversion', value: `${currentRate}%`, detail: `${currentRate - baselineRate} pp vs. comparison`, evidenceId: accounts.id },
        { label: 'Accounts opened', value: format(currentOpened), detail: `${format(currentOpened - baselineOpened)} vs. comparison`, evidenceId: accounts.id },
      )
    }
    if (journeys) {
      answer.metrics.push({ label: 'Mobile web conversion', value: `${journeys.values.mobileCurrent}%`, detail: `${journeys.values.mobileCurrent - journeys.values.mobileBaseline} pp vs. comparison`, evidenceId: journeys.id })
      answer.chart = { title: 'The decline is not across every channel', unit: '%', rows: journeys.rows, evidenceId: journeys.id }
    }
    answer.recommendations = [
      'Have engineering validate the verification failure path and release exposure, then assess remediation under normal change controls.',
      'Compare matched exposed and unexposed cohorts; test for device, acquisition and seasonality confounders before a causal conclusion.',
      'Monitor conversion and verification errors after an approved fix. No business actions are executed by this portal.',
    ]
    answer.limitations.push('Support and incident signals are aligned at aggregate product / time level, not linked to individual applicants.', 'Seasonality and unmeasured differences between exposed and unexposed sessions remain unresolved.')
    answer.followUps = ['Break down the conversion by device and channel', 'Show the supporting customer signals', 'What alternative explanations were checked?']
  } else if (plan.scenario === 'roth' || plan.scenario === 'hsa') {
    const accounts = bySource('accounts')
    if (accounts) {
      const { current, baseline } = accounts.values
      const product = plan.scenario === 'roth' ? 'Roth IRA' : 'HSA'
      answer.headline = `${product} openings are up ${change(current, baseline)} year to date.`
      answer.summary = `${format(current)} distinct ${product} accounts opened in ${plan.period}, compared with ${format(baseline)} in ${plan.comparison}. These are account openings, not unique customers or funded accounts.`
      answer.metrics = [
        { label: 'Accounts opened', value: format(current), detail: plan.period, evidenceId: accounts.id },
        { label: 'Prior-year openings', value: format(baseline), detail: plan.comparison, evidenceId: accounts.id },
        { label: 'Year-over-year growth', value: `+${change(current, baseline)}`, detail: `${format(current - baseline)} additional accounts`, evidenceId: accounts.id },
      ]
      answer.chart = { title: 'Growth across comparable periods', unit: 'accounts', rows: accounts.rows, evidenceId: accounts.id }
      answer.recommendations = ['Validate funded-account conversion separately before interpreting opening growth as growth in assets.']
    }
    answer.followUps = ['Show the source evidence and metric definition', 'How many of these accounts were funded?']
  } else if (plan.scenario === 'volatility') {
    const trading = bySource('trading')
    const market = bySource('market')
    const journeys = bySource('journeys')
    if (trading) {
      answer.headline = market ? 'Higher volatility coincides with more trading activity.' : 'Trading activity increased in the observed cohort.'
      answer.summary = `Executed trades increased ${change(trading.values.current, trading.values.baseline)}, from ${format(trading.values.baseline)} to ${format(trading.values.current)}.${market ? ` The average synthetic volatility index rose from ${market.values.baseline} to ${market.values.current}.` : ' Market context is unavailable.'} This is an association, not evidence that volatility caused the activity change.`
      answer.metrics.push({ label: 'Executed trades', value: format(trading.values.current), detail: `+${change(trading.values.current, trading.values.baseline)} vs. comparison`, evidenceId: trading.id })
      answer.chart = { title: 'Trading activity by instrument group', unit: 'trades', rows: trading.rows, evidenceId: trading.id }
    }
    if (market) answer.metrics.push({ label: 'Volatility index', value: format(market.values.current), detail: `${market.values.baseline} in comparison window`, evidenceId: market.id })
    if (journeys) answer.metrics.push({ label: 'Engaged web sessions', value: format(journeys.values.current), detail: `+${change(journeys.values.current, journeys.values.baseline)} vs. comparison`, evidenceId: journeys.id })
    answer.recommendations = ['Assess engagement and trading at matched cohort level before inferring a market effect.', 'Review service capacity against elevated contact volumes.']
    answer.followUps = ['Show the supporting customer signals', 'Show the source evidence and metric definitions']
  } else if (plan.scenario === 'retention') {
    const retention = bySource('retention')
    if (retention) {
      const { baselineExits, currentExits, eligible } = retention.values
      const currentRate = (eligible - currentExits) / eligible * 100
      const baselineRate = (eligible - baselineExits) / eligible * 100
      answer.headline = 'New relationships warrant a closer retention review.'
      answer.summary = `Customer retention fell from ${format(baselineRate)}% to ${format(currentRate)}%. Exits increased from ${baselineExits} to ${currentExits} among ${format(eligible)} eligible customers per window. Transfer and service signals are candidate explanations, not established causes.`
      answer.metrics = [
        { label: 'Customer retention', value: `${format(currentRate)}%`, detail: `${format(currentRate - baselineRate)} pp vs. comparison`, evidenceId: retention.id },
        { label: 'Customer exits', value: format(currentExits), detail: `${baselineExits} in comparison window`, evidenceId: retention.id },
      ]
      answer.chart = { title: 'Retention by relationship tenure', unit: '%', rows: retention.rows, evidenceId: retention.id }
    }
    answer.recommendations = ['Validate the new-relationship cohort and investigate transfer delays using authorized linkage.', 'Distinguish account-level transfers from customers exiting all retirement relationships.']
    answer.followUps = ['Show the supporting customer signals', 'Show the source evidence and metric definitions']
  } else if (plan.scenario === 'rollovers') {
    const calls = bySource('calls')
    const retirement = bySource('retirement')
    if (calls) {
      answer.headline = 'Customers are asking for rollover status more often.'
      answer.summary = `Rollover calls increased ${change(calls.values.current, calls.values.baseline)}, from ${calls.values.baseline} to ${calls.values.current}.${retirement ? ` Rollover requests increased only ${change(retirement.values.current, retirement.values.baseline)}.` : ''} Status-seeking is the leading observed theme; the cause remains unproven.`
      answer.metrics = [{ label: 'Rollover calls', value: format(calls.values.current), detail: `+${change(calls.values.current, calls.values.baseline)} vs. comparison`, evidenceId: calls.id }]
      answer.chart = { title: 'The contact mix has shifted toward status', unit: 'calls', rows: calls.rows, evidenceId: calls.id }
    }
    answer.recommendations = ['Review processing-time messaging and rollover status visibility.', 'Test revised guidance before attributing any contact reduction to messaging changes.']
    answer.followUps = ['Show the Fidelity Assistant evidence', 'Show the source evidence and metric definitions']
  }
  const focusSupport = /supporting customer|customer signals|assistant evidence/i.test(plan.question)
  const focusAlternatives = /alternative explanation/i.test(plan.question)
  const focus = focusSupport ? ['calls', 'assistant', 'chat', 'search'] : focusAlternatives ? ['campaigns', 'policies', 'market'] : []
  const priority: SourceId[] = ['accounts', 'journeys', 'releases', 'incidents', 'calls', 'assistant', 'chat', 'search', 'mobile', 'customers', 'campaigns', 'policies', 'market']
  const rankedEvidence = plan.scenario === 'conversion'
    ? [...evidence].sort((a, b) => priority.indexOf(a.sourceId) - priority.indexOf(b.sourceId))
    : evidence
  const selectedEvidence = focus.length ? rankedEvidence.filter(item => focus.includes(item.sourceId)) : rankedEvidence
  answer.findings = selectedEvidence.map(item => ({
    text: item.finding, evidenceIds: [item.id],
    strength: item.sourceId === 'releases' || item.sourceId === 'policies' ? 'Association' : 'Observed',
  }))
  if (focusSupport) {
    answer.headline = 'The customer signals behind the investigation.'
    answer.summary = selectedEvidence.length ? 'These are the available aggregate interaction signals. Counts across channels must not be added as unique customers.' : 'No supporting customer-signal evidence is available in this run.'
  }
  if (focusAlternatives) {
    answer.headline = 'Alternative explanations are not all ruled out.'
    answer.summary = 'Review the evidence below. A missing result is not proof that a campaign, policy change, seasonality or market development had no effect.'
  }
  for (const node of errors) answer.limitations.push(`${node.title}: unavailable. Conclusions requiring this source are not established.`)
  for (const node of empty) answer.limitations.push(`${node.title}: no matching demo evidence; coverage is not established.`)
  return answer
}
