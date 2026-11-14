import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connectionPath, layoutInvestigation, SOURCE_HEIGHT, SOURCE_WIDTH, sourcePort } from './canvas-layout.ts'
import type { WorkflowNode } from './types.ts'
import { demoPlanner } from './planner.ts'
import { createDemoConnector } from './fixtures.ts'
import { InvestigationEngine } from './engine.ts'

test('every source remains on the canvas without collisions as the plan expands', () => {
  for (let count = 1; count <= 40; count++) {
    const nodes: WorkflowNode[] = Array.from({ length: count }, (_, i) => ({
      id: `source-${i}`, title: `Source ${i}`, purpose: 'Demo source', kind: 'source', stage: 'discover', status: 'planned', dependencies: [],
    }))
    const layout = layoutInvestigation(nodes)
    const points = Object.values(layout.positions)
    assert.equal(points.length, count)
    for (const point of points) {
      assert.ok(point.x - SOURCE_WIDTH / 2 >= 0)
      assert.ok(point.x + SOURCE_WIDTH / 2 <= layout.width)
      assert.ok(point.y - SOURCE_HEIGHT / 2 >= 0)
      assert.ok(point.y + SOURCE_HEIGHT / 2 <= layout.height)
    }
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        assert.ok(Math.abs(points[a].x - points[b].x) >= SOURCE_WIDTH + 10 ||
          Math.abs(points[a].y - points[b].y) >= SOURCE_HEIGHT + 20, `Overlap for ${count} sources: ${a}, ${b}`)
      }
    }
  }
})

test('connection curves terminate at the source port and intelligence hub', () => {
  const point = { x: 350, y: 440 }
  const hub = { x: 686, y: 420 }
  const port = sourcePort(point, hub)
  assert.deepEqual(port, { x: 475, y: 440 })
  assert.match(connectionPath(port, hub), /^M 475 440 C/)
  assert.ok(connectionPath(port, hub).endsWith('686 420'))
  assert.doesNotMatch(connectionPath(port, hub), /undefined|NaN/)
})

test('simulated tool phases drive real workflow activity and clear on completion', async () => {
  const plan = demoPlanner.plan('How many Roth IRA accounts opened this year?', 'retirement')
  const phases: string[] = []
  const engine = new InvestigationEngine(plan, state => {
    const activity = state.nodes.find(node => node.sourceId === 'accounts')?.activity
    if (activity) phases.push(activity)
  })
  await engine.execute(createDemoConnector({ latency: false }))
  assert.ok(phases.includes('Connecting simulated tool'))
  assert.ok(phases.some(phase => phase.startsWith('Pulling ')))
  assert.ok(phases.includes('Reconciling synthetic evidence'))
  assert.equal(engine.state.nodes[0].activity, undefined)
  assert.equal(engine.state.status, 'complete')
})
