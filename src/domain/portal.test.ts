import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoPlanner } from './planner.ts'
import { profiles, flagshipQuestion } from './profiles.ts'
import { sources } from './sources.ts'
import { createDemoConnector, getFixture } from './fixtures.ts'
import { InvestigationEngine } from './engine.ts'
import { createReviewTicket, listReviewTickets, readReviewTicket, reviewLink, saveReviewTicket } from './reviews.ts'
import { authorizePlan, canUseSource, demoUsers } from './access.ts'
import { buildReportHtml } from './report.ts'
import { installSourceRegistrations, loadSourceRegistry, readSourceRegistrations, registerSource } from './source-admin.ts'
import type { SourceDraft } from './source-admin.ts'
import { demoPassword, demoSessionStorageKey, loadDemoSession, signInDemo, signOutDemo } from './session.ts'
import { describeSourceContext, metricMappingsForQuestion, validateSemanticContext } from './semantics.ts'
import { installMcpRegistrations, loadConnections, readMcpRegistrations, saveMcpServer } from './mcp-admin.ts'
import type { McpDraft } from './mcp-admin.ts'
import type { SemanticContext } from './types.ts'
import type { Connector, Evidence, Investigation, ProfileId, SourceId } from './types.ts'

async function investigate(question: string, profile: ProfileId = 'retirement', previous?: Investigation, failSource?: SourceId) {
  const plan = demoPlanner.plan(question, profile, previous?.plan)
  const engine = new InvestigationEngine(plan, () => {}, previous)
  await engine.execute(createDemoConnector({ latency: false, failSource }))
  return engine
}

function memoryStorage(): Storage {
  const records = new Map<string, string>()
  return {
    get length() { return records.size },
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
    removeItem: key => { records.delete(key) },
    clear: () => records.clear(),
    key: index => [...records.keys()][index] ?? null,
  }
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

test('demo confidence covers every supported analytic and distinguishes associations from observations', async () => {
  for (const question of [
    'How many Roth IRA accounts were opened this year?',
    'How many HSA accounts were opened this year?',
    flagshipQuestion,
    'How is market volatility affecting trading and customer engagement?',
    'What is driving retirement customer attrition?',
    'Why are calls and Fidelity Assistant questions about rollovers increasing?',
  ]) {
    const { state } = await investigate(question)
    const answer = state.answer!
    const isConversion = state.plan.scenario === 'conversion'
    const count = ['roth', 'hsa'].includes(state.plan.scenario)
    // The flagship has 12 evidence-backed sources and one empty policy source.
    const observed = isConversion ? 83 : 90
    const association = isConversion ? 65 : 70
    assert.equal(answer.confidence.score, count ? observed : association, question)
    assert.ok(answer.metrics.length > 0)
    assert.equal(answer.chart!.confidence.score, observed)
    for (const metric of answer.metrics) assert.equal(metric.confidence.score, observed)
    for (const finding of answer.findings) {
      assert.equal(finding.confidence.score, finding.strength === 'Association' ? association : observed)
    }
    if (isConversion) assert.match(answer.confidence.explanation, /12 of 13 selected sources/)
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
    assert.equal(engine.state.answer!.confidence.score, null)
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
  assert.equal(engine.state.answer!.confidence.score, 63)
  assert.equal(engine.state.answer!.metrics[0].confidence.score, 81)
  const called: SourceId[] = []
  await engine.retry({ retrieve: request => { called.push(request.source.id); return Promise.resolve(getFixture(request.source.id, request.plan)) } })
  assert.equal(engine.state.status, 'complete')
  assert.ok(called.includes('releases'))
  assert.equal(called.includes('accounts'), false)
  assert.ok(before.every(id => engine.state.evidence.some(item => item.id === id)))
  assert.equal(new Set(engine.state.evidence.map(item => item.id)).size, engine.state.evidence.length)
  assert.ok(engine.state.nodes.some(node => node.id === 'campaigns'))
  assert.equal(engine.state.answer!.confidence.score, 65)
  assert.equal(engine.state.answer!.metrics[0].confidence.score, 83)
})

test('failure of all initial sources produces no invented metrics', async () => {
  const plan = demoPlanner.plan('How many HSA accounts were opened this year?', 'digital')
  const engine = new InvestigationEngine(plan, () => {})
  await engine.execute(createDemoConnector({ latency: false, failSource: 'accounts' }))
  assert.equal(engine.state.status, 'partial')
  assert.equal(engine.state.evidence.length, 0)
  assert.equal(engine.state.answer!.metrics.length, 0)
  assert.match(engine.state.answer!.headline, /incomplete/)
  assert.equal(engine.state.answer!.confidence.score, null)
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
  assert.equal(next.state.answer!.confidence.score, 83)
  assert.equal(next.state.id, first.state.id)
  assert.equal(next.state.turn, 2)
  assert.equal(next.state.turns[0].answer, first.state.answer)
  assert.deepEqual(next.state.nodes.filter(node => node.kind === 'source').map(node => node.id), first.state.nodes.filter(node => node.kind === 'source').map(node => node.id))
  const unsupported = await investigate('How many of these accounts were funded?', 'retirement', first.state)
  assert.equal(unsupported.state.plan.scenario, 'unsupported')
  assert.equal(unsupported.state.evidence.length, 0)
})

test('recommended follow-ups remain supported across multiple turns without losing their original scope', async () => {
  for (const question of [
    flagshipQuestion, 'How many Roth IRA accounts opened this year?', 'How many HSA accounts opened this year?',
    'How is market volatility affecting trading and engagement?', 'What is driving retirement customer attrition?',
    'Why are rollover support calls increasing?',
  ]) {
    const first = await investigate(question)
    for (const followUp of first.state.answer!.followUps) {
      const next = await investigate(followUp, 'retirement', first.state)
      assert.notEqual(next.state.plan.scenario, 'unsupported', `${question} -> ${followUp}`)
      assert.equal(next.state.id, first.state.id)
      assert.equal(next.state.plan.scope, first.state.plan.scope)
      for (const continuation of next.state.answer!.followUps) {
        const third = await investigate(continuation, 'retirement', next.state)
        assert.notEqual(third.state.plan.scenario, 'unsupported', `${question} -> ${followUp} -> ${continuation}`)
        assert.equal(third.state.plan.contextQuestion, first.state.plan.question)
        assert.equal(third.state.turns.length, 2)
      }
    }
  }
})

test('continuations retain canvas nodes immediately and retrieve only genuinely new source work', async () => {
  const plan = demoPlanner.plan(flagshipQuestion, 'retirement')
  const first = new InvestigationEngine({ ...plan, sources: ['accounts'] }, () => {})
  await first.execute(createDemoConnector({ latency: false }))
  const next = new InvestigationEngine(demoPlanner.plan('Break down the conversion by channel', 'retirement', first.state.plan), () => {}, first.state)
  assert.equal(next.state.nodes.find(node => node.id === 'accounts')?.status, 'complete')
  assert.equal(next.state.nodes.find(node => node.id === 'journeys')?.status, 'planned')
  assert.equal(next.state.evidence[0], first.state.evidence[0])
  const called: SourceId[] = []
  await next.execute({ retrieve: async request => { called.push(request.source.id); return getFixture(request.source.id, request.plan) } })
  assert.equal(called.includes('accounts'), false)
  assert.ok(called.includes('journeys'))
  assert.ok(next.state.nodes.some(node => node.id === 'releases' && node.dependencies.includes('journeys')))
  const third = new InvestigationEngine(demoPlanner.plan('Show transcript snippets', 'retirement', next.state.plan), () => {}, next.state)
  await third.execute({ retrieve: async () => { throw new Error('Cached evidence must not reconnect') } })
  assert.equal(third.state.status, 'complete')
  assert.equal(third.state.id, first.state.id)
  assert.equal(third.state.turns[0].answer!.metrics[0].value, '56%')
  assert.ok(third.state.events.some(event => event.message.includes('Analyzing question 3')))
})

test('a focused follow-up without matching evidence has no confidence estimate', async () => {
  const first = await investigate(flagshipQuestion)
  const plan = demoPlanner.plan('Show the supporting customer signals', 'retirement', first.state.plan)
  const engine = new InvestigationEngine(plan, () => {})
  await engine.execute({
    retrieve: async ({ source, plan: activePlan }) =>
      ['calls', 'assistant', 'chat', 'search'].includes(source.id) ? null : getFixture(source.id, activePlan),
  })
  assert.equal(engine.state.answer!.findings.length, 0)
  assert.equal(engine.state.answer!.confidence.score, null)
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

test('analyst handoffs preserve the assigned evidence, gaps and retrieval details across later retries', async () => {
  const engine = await investigate(flagshipQuestion, 'retirement', undefined, 'releases')
  const ticket = createReviewTicket(engine.state, 'digital-analyst', 'Check the release hypothesis and missing coverage.', 'High')
  assert.equal(ticket.originalQuestion, flagshipQuestion)
  assert.equal(ticket.reviewQuestion, 'Check the release hypothesis and missing coverage.')
  assert.match(ticket.assignee, /Alex Morgan \(sample\)/)
  const content = ticket.sections.map(section => `${section.title}\n${section.content}`).join('\n')
  assert.match(content, /Opening conversion: 56%/)
  assert.match(content, /Demo confidence: 63%/)
  assert.match(content, /Source: Releases & runtime \(error\)/)
  assert.match(content, /Simulated connector failed; no evidence returned/)
  assert.match(content, /No SQL or external query was executed/)
  assert.match(content, /ACCOUNT_OPENINGS/)
  assert.match(content, /"currentOpened": 5600/)
  assert.match(content, /"period": "Oct 26 - Nov 8, 2026"/)
  assert.match(content, /Chart and exact values/)
  assert.match(content, /Requested review outcome/)
  const highlights = ticket.sections.find(section => section.title === 'Question-specific evidence highlights')!
  assert.match(highlights.content, /Scripted demo excerpt - not a real transcript/)
  assert.match(highlights.content, /phone browser/)
  assert.match(highlights.content, /Evidence: conversion:calls/)
  const snapshot = JSON.stringify(ticket)
  await engine.retry(createDemoConnector({ latency: false }))
  assert.equal(JSON.stringify(ticket), snapshot)

  const unsupported = await investigate('Which campaigns improved wealth engagement last month?')
  const proposal = createReviewTicket(unsupported.state, 'retirement-analyst', 'Confirm the scope and collect evidence.', 'Normal')
  assert.ok(proposal.sections.some(section => section.content.includes('Proposed only; retrieval was not executed.')))
  assert.ok(proposal.sections.some(section => section.content.includes('No supported metrics were generated.')))
})

test('question-specific highlights use retrieved sources and distinguish conversation examples from market context', async () => {
  const conversion = await investigate(flagshipQuestion)
  const highlights = conversion.state.answer!.highlights
  assert.match(highlights.find(item => item.sourceId === 'calls')!.observation, /Relative change: 158.3%/)
  assert.match(highlights.find(item => item.sourceId === 'calls')!.excerpt!.text, /identity check/)
  assert.equal(highlights.find(item => item.sourceId === 'market')!.excerpt, undefined)
  assert.equal(conversion.state.answer!.confidence.score, 65)
  for (const highlight of highlights) {
    assert.ok(conversion.state.evidence.some(item => item.id === highlight.evidenceId && item.sourceId === highlight.sourceId))
  }
  const failed = await investigate(flagshipQuestion, 'retirement', undefined, 'calls')
  assert.equal(failed.state.answer!.highlights.some(item => item.sourceId === 'calls'), false)
  await failed.retry(createDemoConnector({ latency: false }))
  assert.ok(failed.state.answer!.highlights.some(item => item.sourceId === 'calls' && item.excerpt))

  const rollovers = await investigate('Why are rollover support calls increasing?')
  assert.match(rollovers.state.answer!.highlights.find(item => item.sourceId === 'calls')!.excerpt!.text, /rollover/)
  assert.doesNotMatch(JSON.stringify(rollovers.state.answer!.highlights), /identity check|volatility index/)
  const market = await investigate('How is market volatility affecting trading and customer engagement?')
  assert.match(market.state.answer!.highlights.find(item => item.sourceId === 'market')!.observation, /18 to 27/)
  assert.match(market.state.answer!.highlights.find(item => item.sourceId === 'calls')!.excerpt!.text, /order/)
  const count = await investigate('How many HSA accounts were opened this year?')
  assert.equal(count.state.answer!.highlights.length, 1)
  assert.match(count.state.answer!.highlights[0].observation, /4 of 4/)
  assert.match(count.state.answer!.highlights[0].summary, /Jul-Sep.*5,100 versus 4,300.*\+800/)
  assert.equal(count.state.answer!.highlights[0].excerpt, undefined)
})

test('transcript and market follow-ups stay focused and never fill gaps with unrelated excerpts', async () => {
  const first = await investigate(flagshipQuestion)
  const transcripts = await investigate('Show transcript snippets', 'retirement', first.state)
  assert.equal(transcripts.state.plan.scenario, 'conversion')
  assert.deepEqual(transcripts.state.answer!.highlights.map(item => item.sourceId), ['calls', 'assistant', 'chat'])
  assert.ok(transcripts.state.answer!.highlights.every(item => item.excerpt))
  assert.equal(transcripts.state.answer!.chart, undefined)
  const assistant = await investigate('Show the Fidelity Assistant evidence', 'retirement', first.state)
  assert.deepEqual(assistant.state.answer!.highlights.map(item => item.sourceId), ['assistant'])
  const market = await investigate('Show the market context', 'retirement', first.state)
  assert.deepEqual(market.state.answer!.highlights.map(item => item.sourceId), ['market'])
  assert.equal(market.state.answer!.highlights[0].excerpt, undefined)
  const count = await investigate('How many HSA accounts were opened this year?')
  const unavailable = await investigate('Show transcript snippets', 'retirement', count.state)
  assert.equal(unavailable.state.answer!.highlights.length, 0)
  assert.equal(unavailable.state.answer!.metrics.length, 0)
  assert.match(unavailable.state.answer!.summary, /No transcript examples/)
  assert.equal(unavailable.state.answer!.confidence.score, null)
  const unsupported = await investigate('How many HSA accounts opened in 2024?')
  assert.equal(unsupported.state.answer!.highlights.length, 0)
})

test('demo review persistence round-trips snapshots and reports invalid links, corrupt data and failed writes', async () => {
  const { state } = await investigate('How many HSA accounts were opened this year?')
  const ticket = createReviewTicket(state, 'retirement-analyst', 'Validate the count.', 'Normal')
  const records = new Map<string, string>()
  const storage: Storage = {
    get length() { return records.size },
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
    removeItem: key => { records.delete(key) },
    clear: () => records.clear(),
    key: index => [...records.keys()][index] ?? null,
  }
  saveReviewTicket(storage, ticket)
  assert.deepEqual(readReviewTicket(storage, ticket.id), ticket)
  assert.deepEqual(listReviewTickets(storage), [ticket])
  assert.throws(() => readReviewTicket(storage, ticket.id, 'demo-digital'), /do not have permission/)
  assert.deepEqual(listReviewTickets(storage, 'demo-digital'), [])
  const link = new URL(reviewLink(ticket.id, 'analysis', 'http://localhost:5180/?demo=1#main-content'))
  assert.equal(link.search, '?demo=1')
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('analysis'), ticket.id)
  assert.throws(() => saveReviewTicket(storage, ticket), /already exists/)
  assert.throws(() => readReviewTicket(storage, crypto.randomUUID()), /not saved here/)
  assert.throws(() => readReviewTicket(storage, 'invalid'), /link is invalid/)
  storage.setItem(storage.key(0)!, JSON.stringify({ ...ticket, sections: [{ title: 'Broken', content: 12 }] }))
  assert.throws(() => readReviewTicket(storage, ticket.id), /damaged/)
  assert.throws(() => saveReviewTicket({
    getItem: () => null,
    setItem: () => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError') },
  }, ticket), /Storage quota exceeded/)
  assert.throws(() => createReviewTicket(state, 'unknown', 'Validate this.', 'Normal'), /Choose a sample analyst/)
  assert.throws(() => createReviewTicket(state, 'digital-analyst', '   ', 'Normal'), /Enter a review question/)
  assert.throws(() => createReviewTicket({ ...state, status: 'running' }, 'digital-analyst', 'Validate this.', 'Normal'), /Wait for the analysis/)
})

test('demo permissions deny out-of-scope questions before any source work and restrict discovered sources', async () => {
  const digital = demoUsers.find(user => user.id === 'demo-digital')!
  const denied = new InvestigationEngine(demoPlanner.plan('How many Roth IRA accounts opened this year?', 'retirement'), () => {}, undefined, digital)
  let calls = 0
  await denied.execute({ retrieve: async () => { calls++; throw new Error('Denied work must never run') } })
  assert.equal(calls, 0)
  assert.equal(denied.state.status, 'denied')
  assert.equal(denied.state.answer, undefined)
  assert.deepEqual(denied.state.nodes, [])
  assert.equal(authorizePlan(demoPlanner.plan('Compare Roth and HSA openings', 'retirement'), digital).status, 'denied')

  const allowedCalls: SourceId[] = []
  const partial = new InvestigationEngine(demoPlanner.plan(flagshipQuestion, 'retirement'), () => {}, undefined, digital)
  await partial.execute({ retrieve: async request => { allowedCalls.push(request.source.id); return getFixture(request.source.id, request.plan) } })
  assert.equal(partial.state.status, 'partial')
  assert.equal(partial.state.access.excludedSourceCount, 6)
  assert.ok(allowedCalls.every(id => canUseSource(digital, id)))
  assert.ok(partial.state.nodes.every(node => !node.sourceId || canUseSource(digital, node.sourceId)))
  assert.ok(partial.state.answer!.highlights.every(item => canUseSource(digital, item.sourceId) && !item.excerpt))
  assert.equal(partial.state.answer!.confidence.score, 38)
  assert.equal(partial.state.answer!.followUps.includes('Show transcript snippets'), false)
  assert.ok(partial.state.answer!.limitations.some(item => item.includes('Permission-limited answer')))
  const followUp = new InvestigationEngine(demoPlanner.plan('Show transcript snippets', 'retirement', partial.state.plan), () => {}, partial.state, digital)
  await followUp.execute({ retrieve: async () => { throw new Error('Restricted transcripts must not be queried') } })
  assert.equal(followUp.state.status, 'denied')
  assert.equal(followUp.state.evidence.length, 0)
  assert.throws(() => new InvestigationEngine(partial.state.plan, () => {}, partial.state, demoUsers[0]), /different demo users/)
  assert.throws(() => new InvestigationEngine(partial.state.plan, () => {}, partial.state, { ...digital, sources: ['accounts'] }), /access has changed/)
})

test('invalid or unreadable demo sessions stay signed out instead of granting executive permissions', () => {
  const invalid = loadDemoSession(() => ({ getItem: () => '{"version":1,"userId":"unknown-user"}' }))
  assert.equal(invalid.user, null)
  assert.match(invalid.error, /invalid/)
  const unavailable = loadDemoSession(() => { throw new DOMException('Storage blocked', 'SecurityError') })
  assert.equal(unavailable.user, null)
  assert.match(unavailable.error, /Storage blocked/)
})

test('portable reports contain self-contained visuals, exact values and escaped user content', async () => {
  const { state } = await investigate(flagshipQuestion)
  const report = buildReportHtml({
    ...state,
    plan: { ...state.plan, question: '<img src=x onerror="alert(1)">' },
    answer: { ...state.answer!, headline: '</title><script>alert(1)</script>' },
  }, demoUsers[0])
  assert.match(report, /<!doctype html>/)
  assert.match(report, /<svg role="img"/)
  assert.match(report, /Mobile web<\/td><td>60<\/td><td>44<\/td><td>-16/)
  assert.match(report, /Oct 26-Nov 1<\/td><td>64<\/td><td>55/)
  assert.match(report, /Scripted demo excerpt - not a real transcript/)
  assert.match(report, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/)
  assert.match(report, /&lt;\/title&gt;&lt;script&gt;/)
  assert.doesNotMatch(report, /<script|<img|<link\b/)
  assert.match(report, /Content-Security-Policy/)
  assert.match(report, /downloaded copies cannot be revoked/)
  assert.throws(() => buildReportHtml({
    ...state, answer: { ...state.answer!, chart: { ...state.answer!.chart!, rows: [{ label: 'Invalid', baseline: 1, current: Infinity }] } },
  }, demoUsers[0]), /invalid numeric value/)
})

test('report export rechecks grants and excludes unauthorized source details from partial reports', async () => {
  const digital = demoUsers.find(user => user.id === 'demo-digital')!
  const engine = new InvestigationEngine(demoPlanner.plan(flagshipQuestion, 'retirement'), () => {}, undefined, digital)
  await engine.execute(createDemoConnector({ latency: false }))
  const report = buildReportHtml(engine.state, digital)
  assert.match(report, /Limited-access answer/)
  assert.match(report, /ACCOUNT_OPENINGS/)
  assert.doesNotMatch(report, /CALL_TRANSCRIPTS|FA_CONVERSATIONS|Scripted demo excerpt/)
  assert.throws(() => buildReportHtml(engine.state, demoUsers[0]), /outside the current demo user grants/)
  assert.throws(() => buildReportHtml(engine.state, { ...digital, sources: ['accounts'] }), /outside the current demo user grants/)
  const denied = new InvestigationEngine(demoPlanner.plan('How many Roth IRA accounts opened this year?', 'retirement'), () => {}, undefined, digital)
  await denied.execute(createDemoConnector({ latency: false }))
  assert.throws(() => buildReportHtml(denied.state, digital), /completed or partial answer/)
})

test('admin source registrations persist, respect grants and enter plans without fabricated connector calls', async context => {
  context.after(() => installSourceRegistrations([]))
  let saved: string | null = null
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
  const admin = demoUsers.find(user => user.isAdmin)!
  const digital = demoUsers.find(user => user.id === 'demo-digital')!
  const draft: SourceDraft = {
    name: 'Account opening audit', platform: 'Snowflake', description: 'Demo account-opening audit metadata.',
    capabilities: ['accounts'], collections: ['ACCOUNT_AUDIT'], joinKeys: ['account_id'], timeField: 'opened_at', allowedUserIds: ['demo-digital'],
  }
  assert.throws(() => registerSource(storage, demoUsers[0], draft), /Only an Admin/)
  assert.equal(saved, null)
  const { registration, registrations } = registerSource(storage, admin, draft)
  assert.deepEqual(readSourceRegistrations(storage), registrations)
  assert.equal(canUseSource(admin, registration.id), true)
  assert.equal(canUseSource(digital, registration.id), true)
  assert.equal(canUseSource(demoUsers[0], registration.id), false)
  installSourceRegistrations([])
  assert.equal(Object.hasOwn(sources, registration.id), false)
  assert.equal(loadSourceRegistry(() => storage).error, '')
  const plan = demoPlanner.plan('How many HSA accounts opened this year?', 'digital')
  assert.ok(plan.sources.includes(registration.id))
  const engine = new InvestigationEngine(plan, () => {}, undefined, digital)
  const called: SourceId[] = []
  await engine.execute({ retrieve: async request => { called.push(request.source.id); return getFixture(request.source.id, request.plan) } })
  assert.deepEqual(called, ['accounts'])
  assert.equal(engine.state.nodes.find(node => node.sourceId === registration.id)?.status, 'unconfigured')
  assert.equal(engine.state.status, 'partial')
  assert.equal(engine.state.evidence.length, 1)
  assert.equal(engine.state.answer!.metrics[0].value, '17,400')
  assert.equal(engine.state.answer!.confidence.score, 45)
  assert.ok(engine.state.answer!.limitations.some(item => item.includes('registered but not connected')))
  assert.match(buildReportHtml(engine.state, digital), /Registered but not connected; no connector call was made/)
  const review = createReviewTicket(engine.state, 'digital-analyst', 'Validate source coverage.', 'Normal')
  assert.ok(review.sections.some(section => section.content.includes('No adapter is implemented for this registered source.')))
  await assert.rejects(createDemoConnector({ latency: false }).retrieve({ source: sources[registration.id], plan, signal: new AbortController().signal }), /no implemented connector/)
  assert.throws(() => registerSource(storage, admin, { ...draft, name: ' ACCOUNT OPENING AUDIT ' }), /already exists/)
  assert.equal(readSourceRegistrations(storage).length, 1)
})

test('invalid source metadata and storage failures do not register or overwrite sources', context => {
  context.after(() => installSourceRegistrations([]))
  const admin = demoUsers.find(user => user.isAdmin)!
  const draft: SourceDraft = {
    name: 'Unpersisted source', platform: 'Demo lake', description: 'A synthetic metadata mapping.',
    capabilities: ['accounts'], collections: ['AUDIT_EVENTS'], joinKeys: ['account_id'], timeField: 'event_at', allowedUserIds: [],
  }
  let writes = 0
  const storage = { getItem: () => null, setItem: () => { writes++; throw new DOMException('Quota exceeded', 'QuotaExceededError') } }
  assert.throws(() => registerSource(storage, admin, { ...draft, capabilities: [] }), /Select at least one capability/)
  assert.throws(() => registerSource(storage, admin, { ...draft, collections: ['https://example.invalid'] }), /valid collection/)
  assert.throws(() => registerSource(storage, admin, { ...draft, allowedUserIds: ['unknown-user'] }), /unknown demo user/)
  assert.throws(() => registerSource(storage, admin, { ...draft, name: 'Accounts & growth' }), /already exists/)
  assert.equal(writes, 0)
  assert.throws(() => registerSource(storage, admin, draft), /Quota exceeded/)
  assert.equal(Object.values(sources).some(source => source.name === draft.name), false)
  const corruptStorage = { getItem: () => '{"version":1,"sources":[{"id":"accounts"}]}', setItem: () => { writes++ } }
  assert.match(loadSourceRegistry(() => corruptStorage).error, /invalid source identifier/)
  assert.throws(() => registerSource(corruptStorage, admin, draft), /invalid source identifier/)
  assert.equal(writes, 1)
  assert.match(loadSourceRegistry(() => { throw new DOMException('Storage blocked', 'SecurityError') }).error, /Storage blocked/)
})

test('dummy login restores only validated sessions, never stores a password, and signs out cleanly', () => {
  const storage = memoryStorage()
  storage.setItem('clarity:demo-user', 'demo-admin')
  assert.equal(loadDemoSession(() => storage).user, null)
  assert.throws(() => signInDemo(storage, 'admin', 'incorrect'), /Incorrect demo/)
  assert.equal(storage.getItem(demoSessionStorageKey), null)
  const user = signInDemo(storage, 'admin', demoPassword)
  assert.equal(user.isAdmin, true)
  assert.equal(loadDemoSession(() => storage).user?.id, user.id)
  assert.doesNotMatch(storage.getItem(demoSessionStorageKey)!, /clarity-demo|password/)
  signOutDemo(storage)
  assert.equal(loadDemoSession(() => storage).user, null)
  assert.throws(() => signInDemo({ setItem: () => { throw new Error('Storage unavailable') } }, 'executive', demoPassword), /Storage unavailable/)
})

const semanticExample: SemanticContext = {
  grain: 'One row per account-opening event', timezone: 'UTC', businessDefinitions: 'Opened is not necessarily funded.', caveats: 'Exclude reopened accounts; do not aggregate identifiers by summing.',
  fields: [
    { name: 'account_id', description: 'Stable account identifier', dataType: 'string', role: 'identifier', aggregation: 'count_distinct', unit: 'accounts' },
    { name: 'opened_at', description: 'First opening timestamp', dataType: 'date', role: 'time', aggregation: 'none', unit: 'UTC' },
  ],
  metrics: [{ intent: 'openings', name: 'Accounts opened', field: 'account_id', definition: 'Count distinct first-opened accounts in the requested product and reporting window.', filters: 'Exclude test and reopened accounts.' }],
}

test('semantic metadata validates field meaning and blocks unsafe or unresolved aggregation mappings', () => {
  assert.deepEqual(validateSemanticContext(semanticExample, 'opened_at'), semanticExample)
  assert.throws(() => validateSemanticContext({ ...semanticExample, fields: [{ ...semanticExample.fields[0], aggregation: 'sum' }, semanticExample.fields[1]] }, 'opened_at'), /cannot be summed/)
  assert.throws(() => validateSemanticContext({ ...semanticExample, metrics: [{ ...semanticExample.metrics[0], field: 'missing_field' }] }, 'opened_at'), /documented field/)
  assert.throws(() => validateSemanticContext({ ...semanticExample, fields: [semanticExample.fields[0]] }, 'opened_at'), /time field/)
  assert.throws(() => validateSemanticContext({ ...semanticExample, timezone: 'Not/A_Timezone' }, 'opened_at'), /valid IANA timezone/)
})

test('editable data context and MCP registrations persist together and remain disconnected during planning', async context => {
  context.after(() => { installSourceRegistrations([]); installMcpRegistrations([]) })
  const storage = memoryStorage()
  const admin = demoUsers.find(user => user.isAdmin)!
  const digital = demoUsers.find(user => user.id === 'demo-digital')!
  const draft: SourceDraft = {
    name: 'Postgres account audit', platform: 'PostgreSQL', providerId: 'postgres', description: 'Demo audit context.',
    capabilities: ['accounts'], collections: ['ACCOUNT_AUDIT'], joinKeys: ['account_id'], timeField: 'opened_at', allowedUserIds: [digital.id],
  }
  const first = registerSource(storage, admin, draft)
  const updated = registerSource(storage, admin, { ...draft, semanticContext: semanticExample }, first.registration.id)
  assert.equal(updated.registrations.length, 1)
  assert.equal(updated.registration.id, first.registration.id)
  const mcpDraft: McpDraft = {
    templateId: 'postgres', name: 'Postgres audit tools', description: 'Read-only account metadata tools.', transport: 'streamable-http',
    endpoint: 'https://mcp.example.com/mcp', command: '', args: [], toolNames: ['list_tables'], capabilities: ['accounts'], allowedUserIds: [digital.id],
  }
  const mcp = saveMcpServer(storage, admin, mcpDraft)
  installSourceRegistrations(updated.registrations)
  assert.ok(sources[mcp.server.id])
  installMcpRegistrations(mcp.servers)
  assert.ok(sources[first.registration.id])
  const loaded = loadConnections(() => storage)
  assert.equal(loaded.error, '')
  assert.equal(loaded.registrations[0].semanticContext?.fields.length, 2)
  assert.equal(loaded.servers.length, 1)
  assert.equal(canUseSource(demoUsers[0], mcp.server.id), false)
  const plan = demoPlanner.plan('How many HSA accounts opened this year?', 'digital')
  assert.equal(metricMappingsForQuestion(sources[first.registration.id], plan)[0].field, 'account_id')
  assert.match(describeSourceContext(sources[first.registration.id], plan), /COUNT_DISTINCT\(account_id\)/)
  assert.equal(metricMappingsForQuestion(sources[first.registration.id], { ...plan, context: { ...plan.context, metrics: ['retention'] } }).length, 0)
  const calls: SourceId[] = []
  const engine = new InvestigationEngine(plan, () => {}, undefined, digital)
  await engine.execute({ retrieve: async request => { calls.push(request.source.id); return getFixture(request.source.id, request.plan) } })
  assert.deepEqual(calls, ['accounts'])
  assert.equal(engine.state.nodes.find(node => node.sourceId === mcp.server.id)?.status, 'unconfigured')
  assert.match(engine.state.nodes.find(node => node.sourceId === first.registration.id)!.finding!, /COUNT_DISTINCT\(account_id\)/)
  assert.equal(engine.state.evidence.length, 1)
  assert.match(buildReportHtml(engine.state, digital), /Governed data context/)
  assert.ok(createReviewTicket(engine.state, 'digital-analyst', 'Check the mapping.', 'Normal').sections.some(section => section.content.includes('COUNT_DISTINCT(account_id)')))
})

test('MCP configuration rejects credentials, unsafe transports and non-admin writes without executing commands', context => {
  context.after(() => installMcpRegistrations([]))
  const storage = memoryStorage()
  const admin = demoUsers.find(user => user.isAdmin)!
  const draft: McpDraft = { templateId: 'custom', name: 'Demo MCP', description: 'Demo tool server metadata.', transport: 'streamable-http', endpoint: 'https://mcp.example.com/mcp', command: '', args: [], toolNames: [], capabilities: ['accounts'], allowedUserIds: [] }
  assert.throws(() => saveMcpServer(storage, demoUsers[0], draft), /Only an Admin/)
  assert.throws(() => saveMcpServer(storage, admin, { ...draft, endpoint: 'https://user:dummy@mcp.example.com/mcp' }), /without credentials/)
  assert.throws(() => saveMcpServer(storage, admin, { ...draft, endpoint: 'https://mcp.example.com/mcp?token=dummy' }), /without credentials/)
  assert.throws(() => saveMcpServer(storage, admin, { ...draft, endpoint: 'http://remote.example.com/mcp' }), /Use HTTPS/)
  assert.throws(() => saveMcpServer(storage, admin, { ...draft, transport: 'stdio', command: 'npx;echo' }), /not a shell command/)
  assert.equal(storage.length, 0)
  const local = saveMcpServer(storage, admin, { ...draft, transport: 'stdio', command: 'npx', args: ['example-demo-server'] })
  assert.equal(local.server.endpoint, '')
  assert.equal(readMcpRegistrations(storage)[0].command, 'npx')
  assert.equal(sources[local.server.id].handler, 'unconfigured')
})
