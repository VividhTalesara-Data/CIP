import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoPlanner } from './planner.ts'
import { profiles, flagshipQuestion } from './profiles.ts'
import { sources } from './sources.ts'
import { createDemoConnector, getFixture } from './fixtures.ts'
import { InvestigationEngine } from './engine.ts'
import type { Connector, Evidence, Investigation, ProfileId, SourceId } from './types.ts'

async function investigate(question: string, profile: ProfileId = 'retirement', previous?: Investigation, failSource?: SourceId) {
  const plan = demoPlanner.plan(question, profile, previous?.plan)
  const engine = new InvestigationEngine(plan, () => {}, previous)
  await engine.execute(createDemoConnector({ latency: false, failSource }))
  return engine
}

test('profiles have four or five distinct role-specific suggestions', () => {
  for (const profile of Object.values(profiles)) {
    assert.ok(profile.questions.length >= 4 && profile.questions.length <= 5)
    assert.equal(new Set(profile.questions.map(item => item.question)).size, profile.questions.length)
  }
  assert.notDeepEqual(profiles.retirement.questions, profiles.wealth.questions)
})

test('input validation rejects empty and oversized requests', () => {
  assert.throws(() => demoPlanner.plan('   ', 'retirement'), /Enter a question/)
  assert.throws(() => demoPlanner.plan('x'.repeat(2001), 'retirement'), /2,000/)
})

test('simple account count selects one source and uses equivalent YTD windows', async () => {
  const engine = await investigate('How many Roth IRA accounts were opened this year compared with last year?')
  assert.equal(engine.state.plan.scenario, 'roth')
  assert.deepEqual(engine.state.plan.sources, ['accounts'])
  assert.equal(engine.state.plan.period, 'Jan 1 - Nov 12, 2026')
  assert.equal(engine.state.plan.comparison, 'Jan 1 - Nov 12, 2025')
  assert.match(engine.state.answer!.headline, /18%/)
  assert.equal(engine.state.answer!.metrics[0].value, '23,600')
  assert.equal(engine.state.nodes.filter(node => node.kind === 'source').length, 1)
})

test('opening chart totals equal evidence and answer metrics for both products', async () => {
  for (const product of ['Roth IRA', 'HSA']) {
    const engine = await investigate(`How are ${product} account openings trending this year?`)
    const item = engine.state.evidence[0]
    assert.equal(item.rows.reduce((sum, row) => sum + row.current, 0), item.values.current)
    assert.equal(item.rows.reduce((sum, row) => sum + row.baseline, 0), item.values.baseline)
    assert.equal(engine.state.answer!.chart!.evidenceId, item.id)
  }
})

test('capability routing composes sources for campaigns, social and appointments', () => {
  const campaign = demoPlanner.plan('Which campaigns improved digital engagement?', 'digital')
  for (const id of ['campaigns', 'journeys', 'accounts']) assert.ok(campaign.sources.includes(id as SourceId))
  const social = demoPlanner.plan('What are the latest social themes about our mobile app?', 'digital')
  assert.ok(social.sources.includes('social'))
  assert.ok(social.sources.includes('social-live'))
  assert.ok(social.sources.includes('mobile'))
  const appointments = demoPlanner.plan('How are wealth appointments converting to funded accounts?', 'wealth')
  assert.equal(appointments.scenario, 'unsupported')
  assert.ok(appointments.sources.includes('appointments'))
})

test('unknown and unsupported scopes never reuse fixture values', async () => {
  const questions = [
    'How many HSA accounts opened in 2024?', 'How many Roth accounts opened last month?',
    'How many Roth accounts opened in 2025?', 'How many Roth accounts opened in California?',
    'Forecast HSA account openings', 'Compare Roth and HSA openings', 'Which RMD cohorts are outstanding?',
    'How many Roth and rollover accounts were opened?', 'Tell me the weather on Mars',
    'How many HSA accounts opened in Ohio?', 'Break down Roth account openings by channel',
    'Who opened Roth IRA accounts this year?', 'How many HSA accounts opened since January?',
  ]
  for (const question of questions) {
    const engine = await investigate(question)
    assert.equal(engine.state.plan.scenario, 'unsupported', question)
    assert.equal(engine.state.evidence.length, 0)
    assert.equal(engine.state.answer!.metrics.length, 0)
  }
})

test('materially ambiguous performance question requests clarification', () => {
  const plan = demoPlanner.plan('How did retirement accounts perform this year?', 'retirement')
  assert.ok(plan.clarification)
  assert.equal(plan.scenario, 'unsupported')
})

test('initial retrievals run concurrently and evidence expands dependency graph', async () => {
  const plan = demoPlanner.plan(flagshipQuestion, 'retirement')
  const started: SourceId[] = []
  const pending: (() => void)[] = []
  const connector: Connector = {
    retrieve: ({ source, plan: activePlan }) => {
      started.push(source.id)
      if (['accounts', 'journeys'].includes(source.id)) {
        return new Promise<Evidence | null>(resolve => pending.push(() => resolve(getFixture(source.id, activePlan))))
      }
      return Promise.resolve(getFixture(source.id, activePlan))
    },
  }
  const engine = new InvestigationEngine(plan, () => {})
  const execution = engine.execute(connector)
  assert.deepEqual(started, ['accounts', 'journeys'])
  assert.equal(engine.state.nodes.some(node => node.id === 'releases'), false)
  pending.forEach(resolve => resolve())
  await execution
  assert.ok(engine.state.nodes.some(node => node.id === 'releases' && node.dependencies.includes('journeys')))
  assert.ok(engine.state.nodes.some(node => node.id === 'campaigns' && node.dependencies.includes('releases')))
  assert.equal(engine.state.nodes.find(node => node.id === 'policies')?.status, 'empty')
  assert.match(engine.state.answer!.summary, /causality has not been established/)
  assert.equal(engine.state.answer!.metrics[0].value, '56%')
  assert.deepEqual(engine.state.answer!.findings[2].evidenceIds, ['conversion:releases'])
  assert.ok(engine.state.answer!.limitations.some(item => item.includes('Policies')))
})

test('conversion cohorts reconcile exactly to total account openings', async () => {
  const engine = await investigate(flagshipQuestion)
  const accounts = engine.state.evidence.find(item => item.sourceId === 'accounts')!
  const journeys = engine.state.evidence.find(item => item.sourceId === 'journeys')!
  const starts = [journeys.values.mobileStarts, journeys.values.desktopStarts, journeys.values.appStarts]
  const currentTotal = journeys.rows.reduce((sum, row, i) => sum + row.current / 100 * starts[i], 0)
  const baselineTotal = journeys.rows.reduce((sum, row, i) => sum + row.baseline / 100 * starts[i], 0)
  assert.equal(currentTotal, accounts.values.currentOpened)
  assert.equal(baselineTotal, accounts.values.baselineOpened)
})

test('source failure preserves successful evidence; retry runs only missing work', async () => {
  const engine = await investigate(flagshipQuestion, 'retirement', undefined, 'releases')
  const before = engine.state.evidence.map(item => item.id)
  assert.equal(engine.state.status, 'partial')
  assert.equal(engine.state.nodes.find(node => node.id === 'releases')?.status, 'error')
  assert.doesNotMatch(engine.state.answer!.summary, /Release exposure/)
  const called: SourceId[] = []
  await engine.retry({ retrieve: request => { called.push(request.source.id); return Promise.resolve(getFixture(request.source.id, request.plan)) } })
  assert.equal(engine.state.status, 'complete')
  assert.ok(called.includes('releases'))
  assert.equal(called.includes('accounts'), false)
  assert.ok(before.every(id => engine.state.evidence.some(item => item.id === id)))
  assert.equal(new Set(engine.state.evidence.map(item => item.id)).size, engine.state.evidence.length)
  assert.ok(engine.state.nodes.some(node => node.id === 'campaigns'))
})

test('failure of all initial sources produces no invented metrics', async () => {
  const plan = demoPlanner.plan('How many HSA accounts were opened this year?', 'digital')
  const engine = new InvestigationEngine(plan, () => {})
  await engine.execute(createDemoConnector({ latency: false, failSource: 'accounts' }))
  assert.equal(engine.state.status, 'partial')
  assert.equal(engine.state.evidence.length, 0)
  assert.equal(engine.state.answer!.metrics.length, 0)
  assert.match(engine.state.answer!.headline, /incomplete/)
})

test('cancellation stops late results and can resume', async () => {
  const plan = demoPlanner.plan(flagshipQuestion, 'retirement')
  const engine = new InvestigationEngine(plan, () => {})
  const pending = engine.execute(createDemoConnector({ latency: true }))
  engine.cancel()
  await pending
  assert.equal(engine.state.status, 'cancelled')
  assert.equal(engine.state.evidence.length, 0)
  assert.equal(engine.state.answer, undefined)
  await engine.retry(createDemoConnector({ latency: false }))
  assert.equal(engine.state.status, 'complete')
})

test('follow-ups reuse compatible evidence and change answer focus', async () => {
  const first = await investigate(flagshipQuestion)
  const next = await investigate('Show the supporting customer signals', 'retirement', first.state)
  assert.equal(next.state.plan.scenario, 'conversion')
  assert.ok(next.state.nodes.some(node => node.reused))
  assert.match(next.state.answer!.headline, /customer signals/)
  assert.ok(next.state.answer!.findings.every(finding => finding.evidenceIds.every(id => /calls|assistant|chat|search/.test(id))))
  const unsupported = await investigate('How many of these accounts were funded?', 'retirement', first.state)
  assert.equal(unsupported.state.plan.scenario, 'unsupported')
  assert.equal(unsupported.state.evidence.length, 0)
})

test('explicit new product follow-up does not inherit retirement conversion', async () => {
  const first = await investigate(flagshipQuestion)
  const next = await investigate('How are HSA account openings trending this year?', 'retirement', first.state)
  assert.equal(next.state.plan.scenario, 'hsa')
  assert.equal(next.state.nodes.some(node => node.reused), false)
})

test('retention segments reconcile to exits and correct customer grain', async () => {
  const engine = await investigate('What is driving retirement customer attrition?')
  const retention = engine.state.evidence.find(item => item.sourceId === 'retention')!
  const baselineExits = retention.rows.reduce((sum, row) => sum + Math.round((100 - row.baseline) / 100 * 5000), 0)
  const currentExits = retention.rows.reduce((sum, row) => sum + Math.round((100 - row.current) / 100 * 5000), 0)
  assert.equal(baselineExits, retention.values.baselineExits)
  assert.equal(currentExits, retention.values.currentExits)
  assert.equal(engine.state.answer!.metrics[0].value, '98.4%')
})

test('rollover and market investigations select distinct evidence and cite every metric', async () => {
  for (const question of ['Why are calls and Fidelity Assistant questions about rollovers increasing?', 'How is market volatility affecting trading and customer engagement?']) {
    const engine = await investigate(question)
    assert.notEqual(engine.state.plan.scenario, 'unsupported')
    assert.ok(engine.state.evidence.length >= 4)
    for (const metric of engine.state.answer!.metrics) assert.ok(engine.state.evidence.some(item => item.id === metric.evidenceId))
    for (const finding of engine.state.answer!.findings) for (const id of finding.evidenceIds) assert.ok(engine.state.evidence.some(item => item.id === id))
  }
})

test('connector contract rejects evidence from mismatched reporting periods', async () => {
  const plan = demoPlanner.plan('How many HSA accounts opened this year?', 'digital')
  const engine = new InvestigationEngine(plan, () => {})
  await engine.execute({ retrieve: async ({ source }) => ({ ...getFixture(source.id, plan)!, period: 'wrong dates' }) })
  assert.equal(engine.state.status, 'partial')
  assert.equal(engine.state.evidence.length, 0)
  assert.match(engine.state.nodes[0].error!, /does not match/)
})

test('registry covers enterprise mappings without fabricated endpoints', () => {
  assert.ok(sources.assistant.collections.includes('FA_CONVERSATIONS'))
  assert.equal(sources.assistant.name, 'Fidelity Assistant')
  assert.equal(sources.policies.connectionKey, 'INTERNAL_NEWS_CONNECTOR')
  for (const item of Object.values(sources)) {
    assert.ok(item.joinKeys.length > 0)
    assert.ok(item.timeField)
    assert.equal(item.handler, 'demo')
    assert.doesNotMatch(JSON.stringify(item), /https?:\/\//)
  }
})
