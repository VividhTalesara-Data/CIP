# Clarity - Customer Intelligence Portal

A working, question-first React application: a minimal personalized entry screen
expands into a floating, animated source-connection canvas, then a linked executive
answer. This is a spatial investigation, not a stacked workflow or loading spinner.

**Demo mode only.** All source activity, records, account metrics, incidents and
findings are synthetic. No enterprise system or language-model provider is
connected. This independent prototype is not affiliated with Fidelity Investments.

## Run locally

Requires Node.js 22.18+ (validated on Node.js 24) and npm.

```powershell
git clone https://github.com/VividhTalesara-Data/CIP.git
Set-Location CIP
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173. Using `npm.cmd` avoids Windows PowerShell script-policy
restrictions without changing execution policy. The development server binds to
loopback, not the public network.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
npx.cmd playwright install chromium
npm.cmd run test:ui
```

`npm run build` performs strict TypeScript checking and creates the static bundle
in `dist`. `npm run preview` serves that bundle locally. The UI tests reuse an
existing server on port 5173 or start a test server automatically.

## Explore

Select Retirement, Wealth, Digital experience, or Customer engagement. Suggestions
change with the profile; arbitrary questions remain available.

The flagship suggestion is:

> I'm seeing lower conversion in the retirement account-opening journey.
> What's going on?

It starts with account and journey evidence. Verification friction discovers
release, incident, channel and support branches. Release evidence then triggers
checks of campaign, policy and historical market context. The result separates
observations from associations, includes missing coverage, and does not claim
causation from timing alone.

Additional synthetic scenarios:

| Question family | Fixture scope |
| --- | --- |
| Roth IRA openings | 23,600 vs. 20,000 distinct accounts; equivalent YTD windows |
| HSA openings | 17,400 vs. 15,000 distinct accounts; equivalent YTD windows |
| Retirement conversion | 56% vs. 64%; channel cohorts reconcile to account totals |
| Volatility and engagement | Historical market, trading, fixed customer cohort and service signals |
| Retirement retention | Customer-level retention, relationship tenure, calls and transfers |
| Rollover contacts | Calls, Fidelity Assistant, rollover activity, policy and search |

YTD windows are January 1-November 12, 2026 versus the equivalent 2025 period.
Diagnostic fixtures use October 26-November 8 versus October 12-25, 2026.
All timestamps are UTC. The snapshot is fixed, not a claim of current freshness.

## The investigation in motion

- Source nodes fly outward from the intelligence hub or the source that discovered
  them. They float in space while tools connect, retrieve and reconcile.
- Animated curves show tool calls, returning data, and evidence-led dependencies.
  Traveling packets name the dataset being pulled; completed evidence flies back
  toward the central hub with the actual synthetic finding.
- The central analysis orb has moving orbital rings and a connected insight
  destination. Source errors and cancellations stop the corresponding transfer.
- Question-specific source selection drives the scene: a Roth count has one
  source, the flagship conversion investigation progressively expands to thirteen,
  and a market question has a different constellation.
- The full map remains visible when the answer is ready. Click **View insight**
  to navigate to the answer, or inspect a floating source directly.
- **Pause motion** freezes visual motion without stopping retrieval. **Cancel**
  aborts retrieval. **Replay demo** reruns the same plan with simulated latency
  and no cached evidence; it does not call real services.
- Zoom, fit, drag-to-pan and expanded-canvas controls let you inspect larger maps.
  A readable **Source list** is available at every viewport size. System
  reduced-motion preferences disable flying packets and spatial animation.

Use **Demo workspace** to disable simulated connector latency or inject a source
failure. The adapter simulates connecting, retrieving and reconciling over roughly
3-4 seconds per source, with independent sources running in parallel. These
explicitly simulated stages drive both the state machine and visuals; no additional
delay is imposed after results are available. Retry restores the failed demo
connector while retaining successful evidence. Cancel aborts pending retrievals,
preserves completed evidence and permits resumption.

Click metrics, findings, source cards or chart evidence to inspect definitions,
grain, values, placeholder collections, candidate join keys, periods and caveats.
All selected sources remain in the spatial map, with zoom and a readable source
list for dense investigations. Charts have exact-value tables. Reduced-motion
mode retains all information.

Follow-ups reuse compatible evidence from the immediately preceding question.
Different products and periods do not share fixture results. Recent investigations
exist in memory for the current browser session only; reload clears them.

## Architecture and extension points

| Responsibility | Location |
| --- | --- |
| Presentation, dialogs and answer UI | [src/App.tsx](src/App.tsx) |
| Floating nodes, animated connections, packets, orb and canvas controls | [src/components/InvestigationCanvas.tsx](src/components/InvestigationCanvas.tsx), [canvas styles](src/components/InvestigationCanvas.css) |
| Scalable source positioning and connection geometry | [src/domain/canvas-layout.ts](src/domain/canvas-layout.ts) |
| Lazy-loaded chart | [src/components/EvidenceChart.tsx](src/components/EvidenceChart.tsx) |
| Design tokens, responsive styles, reduced motion | [src/index.css](src/index.css), [src/App.css](src/App.css) |
| Personalized questions | [src/domain/profiles.ts](src/domain/profiles.ts) |
| Source mappings and capabilities | **[src/domain/sources.ts](src/domain/sources.ts)** |
| Context extraction and capability selection | [src/domain/planner.ts](src/domain/planner.ts) |
| Connector and workflow contracts | [src/domain/types.ts](src/domain/types.ts) |
| Dependency scheduler, events, cancellation, retry | [src/domain/engine.ts](src/domain/engine.ts) |
| Synthetic evidence and demo connector | [src/domain/fixtures.ts](src/domain/fixtures.ts) |
| Evidence-derived summaries and calculations | [src/domain/answers.ts](src/domain/answers.ts) |
| Domain regression and geometry tests | [src/domain/portal.test.ts](src/domain/portal.test.ts), [src/domain/canvas-layout.test.ts](src/domain/canvas-layout.test.ts) |
| Browser and accessibility tests | [tests/portal.spec.ts](tests/portal.spec.ts) |

The offline planner composes intent, metric, product, channel and timeframe
concepts, then selects sources by capabilities. Emerging evidence supplies
additional capabilities. This is intentionally **not** a general-purpose LLM
planner or unrestricted natural-language query engine. It supports finite
synthetic evidence contracts; unsupported questions get a proposed source plan
and no fabricated metrics. Proposed routing must be validated before live use.

The same `Investigation` object owns nodes, operational events, provenance and
the final answer. Nodes distinguish retrieval, analysis and synthesis. No
decorative parallel state machine pretends to query real systems.

### Add a source mapping

1. Extend `Capability` / `SourceId` in the contracts.
2. Add the source to the registry: platform, domains, capabilities, collections,
   join keys, time field, freshness, display name, access requirement and
   connection key.
3. Add a connector implementation or coherent synthetic fixture.
4. Describe which metric needs the capability and/or which evidence discovers it.
5. Add routing, evidence consistency and failure tests.

All collection names are illustrative placeholders. Newsline / My GPS has a
configurable connection key, **not an invented internal URL**. Fidelity Assistant
means the chatbot. Campaign selection combines Confluence context with Snowflake
activity/outcomes. Social selection uses curated Snowflake data and, for freshness,
Sprinklr; a live adapter must deduplicate by platform and post ID.

### Moving to live mode

There is deliberately no "Live" switch that changes a label without implementing
the corresponding system. No secrets belong in Vite environment variables or
browser code.

Before deploying against enterprise data:

1. Add an authenticated server API and enterprise SSO. Enforce row/column and
   business-unit authorization server-side; the profile selector is not access
   control.
2. Move planning and orchestration to that server. Implement a structured,
   validated planner using an approved model and governed metric catalog. The
   current local demo planner is synchronous; the server boundary should be
   asynchronous.
3. Implement read-only adapters for Snowflake, ServiceNow, Splunk, Confluence,
   approved historical market feeds, Sprinklr and configured internal news.
   Validate metric grain, cardinality, time zones, permissions, source freshness,
   deduplication and schema before accepting results.
4. Stream operational node events and evidence references through authenticated
   SSE (or equivalent) into the same presentation model. Add reconnection,
   resumable run identifiers and server-owned cancellation.
5. Persist evidence and lineage in approved storage. Scope caches and follow-up
   retrieval to the authenticated user, authorization policy, metric definition
   and reporting window. Avoid individual-level linkage where unavailable.
6. Add bounded query timeouts, retry policies, cost/step budgets, input/output
   validation, redacted audit logs, provider residency/retention controls and
   prompt-injection defenses. Retrieved documents are data, not instructions.
7. Evaluate real answers against business-approved gold cases. Causal claims
   require an appropriate design, not just temporal correlation.

The demo has no production authentication, durable storage, live SQL generation,
server adapters, external news retrieval or autonomous business actions.
Recommendations never execute changes.

## Validation coverage

Domain tests cover personalization, empty/oversized questions, compositional
routing, unavailable date/population scopes, parallel execution, evidence-led
branches, count/funnel/retention reconciliation, provenance, source errors,
retry, cancellation, follow-up reuse and connector-contract mismatches. Geometry
tests verify non-overlapping source placement for 1-40 nodes and valid connection
endpoints. Connector-phase tests verify that tool activity comes from execution.

Playwright tests cover keyboard submission and newlines, profile switching,
evidence dialogs and focus restoration, flagship branches, follow-ups,
unsupported questions, injected failures, retry/cancel/resume, phone layout,
reduced motion and automated axe WCAG A/AA checks. Animation tests measure
actual node and packet displacement in the browser, verify progressive dependency
connections, question-specific constellations, pause/resume, replay, zoom and
expanded-canvas behavior. These checks do not merely assert that an animation
class exists.

Automated checks do not replace manual assistive-technology testing or a
production financial-data/security review.

## Libraries and licensing

- React, Vite, TypeScript, Tailwind CSS: open-source foundations.
- [Motion core](https://github.com/motiondivision/motion/blob/main/LICENSE.md):
  MIT; layout and state transitions.
- [Recharts](https://github.com/recharts/recharts/blob/main/LICENSE): MIT;
  lazy-loaded charts.
- Lucide React: ISC; icons.
- Playwright and axe-core: development-only test tools.

No paid components, remote fonts, tracking scripts or third-party image assets
are used. Animmaster Lib was excluded because its terms grant use through
purchase. Skiper's free components require attribution; Vengeance UI's public
repository has an MIT license, but neither was needed for this cohesive custom
interface. Preserve dependency license notices when distributing.
