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

## Demo sign-in

The portal opens with a username/password sign-in screen instead of a role
dropdown. These are **public dummy credentials**, not real authentication.

All accounts use the password **`clarity-demo`**:

| Username | Destination and access |
| --- | --- |
| `admin` | Dedicated administration workspace: data connections, data context, MCP tools |
| `executive` | Existing user home with all built-in demo scopes |
| `retirement` | Existing home personalized for the retirement leader's grants |
| `digital` | Existing home personalized for the digital analyst's grants |
| `service` | Existing home personalized for service/rollover analysis |

Sample-account buttons fill the form; **Sign in** validates the dummy credentials.
Only the selected user ID is saved, never the entered password. **Sign out**
cancels active work and removes the current conversation and dialogs. Invalid
saved sessions remain signed out. Old persona-dropdown settings do not
automatically sign anyone in. Existing source mappings and owner-scoped analyst
reviews remain available after the appropriate login.

Normal users keep the same questions, canvas, analytics, analyst-review and export
flows. Admins can choose **Preview user portal** to try those flows without leaving
their admin session. Never enter a real password or production credentials.

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

Follow-ups continue the same conversation and canvas. Compatible questions retain
source nodes, connections and evidence immediately; only additional sources are
retrieved. The canvas highlights evidence used for the current answer and records
each question's new analysis work without pretending cached data was queried again.
**Conversation so far** preserves earlier answers, metrics, chart values and
highlights. **View updated canvas** returns to the shared map.

Recommended follow-ups retain the original scenario context across multiple
turns, including channel, transcript, market, definition and reporting-period
questions. A new product or reporting scope stays in the conversation but requires
new evidence; incompatible fixture values are never reused. Unsupported requests
still receive an explicit limitation, not an invented result. Recent conversations
remain in memory for the current browser session only; reload clears them unless
a separate analyst-review snapshot was saved.
The follow-up composer stays within the answer section below the canvas. It
appears once that section reaches the upper half of the viewport, and hides when
you scroll back to the canvas or expand it. Draft text is preserved while hidden;
the composer never overlays the investigation canvas.

### Demo confidence

Every answer, metric, chart and finding includes a **Demo confidence** indicator.
It is an illustrative heuristic, not a calibrated probability of correctness,
statistical confidence interval or proof of causation.
The answer keeps a large confidence score near the top, with a plain-language
explanation and an expandable scoring method. The prominent **Assign to analyst**
section follows the analysis, recommendations and limitations, before follow-up
suggestions. Both remain in the answer section, not over the canvas.

- Coverage = selected source nodes that completed with linked evidence / all
  selected source nodes, including evidence-discovered branches.
- Score = coverage multiplied by a 90% ceiling for direct observations (including
  metrics and charts), or a 70% ceiling for associations and diagnostic summaries,
  rounded to the nearest whole percent. These ceilings are demo design choices,
  not empirically validated estimates.
- Each item uses investigation-wide coverage. Empty, failed, cancelled and pending
  sources count as gaps; retry recalculates scores. Undiscovered sources and
  untested explanations remain unknown.
- Unsupported questions and runs without supported evidence show **Not assessed**,
  never an invented percentage. No demo score reaches 100%.

The answer's **How demo confidence is scored** disclosure explains the calculation.
Production confidence would require evaluation and calibration against approved
business evidence.

### Question-specific evidence highlights

Answers now include source-linked engagement summaries, business context and
historical market summaries when the retrieved evidence supports them. Conversion
questions show verification-themed support examples; rollover questions show
status-seeking examples; trading questions show trading-related examples and
historical volatility context. Opening-count questions instead compare their
actual reporting segments, without unrelated conversations or market commentary.

Transcript snippets are **scripted demo excerpts**, not real customer transcripts
or representative samples. They illustrate a theme; they do not establish its
frequency, sentiment, causal effect or linkage to an individual customer. They
do not raise confidence scores. Market context uses the fixture's reporting
window, not current headlines, and never turns an association into causation.
Engagement percentage changes are calculated from each source's own counts;
different channels are not added together as unique customers.

Use **Show transcript snippets** or **Show the market context** to focus a
follow-up. Failed, empty and unrelated sources do not supply highlights; absent
evidence is stated explicitly. Each card opens its source evidence, and analyst
handoffs preserve the highlights, excerpt labels and caveats in their snapshots.

### Assign an analyst review

Choose **Assign to analyst** on a generated answer, select a clearly labeled
sample analyst, edit the review question and set a priority. **Create demo review
story** saves a Jira-style demo ticket and confirms its ID and assignee. No real
Jira issue is created and no analyst is notified.

The handoff captures a read-only analysis snapshot: original and review questions,
summary, confidence and scoring basis, metrics, chart values, findings and evidence
references, scope, reporting windows, assumptions, limitations, recommendations,
all selected sources (including failed/empty/proposed ones), source metadata,
fixture lookup inputs, retrieved evidence, activity log and expected review outcome.
No SQL or external query was executed; the handoff says so rather than inventing
queries. Reused evidence and unsuccessful retrievals are identified explicitly.

Use **Open saved analysis** or **Analyst reviews** in the header to reopen it.
Tickets and snapshots persist in this browser's local storage, independently of
the in-memory recent-investigation list. Links survive reloads only in the same
browser profile and app origin (including port). They are not cross-user sharing
links; clearing storage removes them. Later retries or investigations do not
change an assigned snapshot. Storage failures are reported without a success
confirmation. Enter only demo information.

A real assignment service would need authenticated analyst lookup, server-side
snapshot storage and authorization, and an approved Jira integration before
claiming delivery or issuing shareable links.

### Per-user permissions

The signed-in demo identity is separate from the business perspective. Accounts
have explicit scenario/product and source grants; only the admin account sees
the administration workspace and can configure connections or data context.
**View my access** lists the active grants.

- Out-of-scope questions and explicitly requested evidence with no permitted
  source are denied before retrieval; no answer is generated.
- Mixed-access questions run only permitted sources and show **Limited-access
  answer**. Discovered sources are checked before they enter the canvas or call a
  connector. Exclusions count as gaps in demo confidence; permission gaps cannot
  be fixed by connector retry.
- Follow-ups and suggestions use the same policy. A different perspective does
  not expand grants. Signing out before changing accounts cancels work and clears in-memory
  conversations, evidence and open dialogs.
- Saved review lists and deep links are scoped to their creating demo user.
  Legacy snapshots without an owner belong only to the executive demo identity.
  Valid demo sessions survive reloads; invalid/unreadable session storage remains
  signed out rather than defaulting to a privileged identity.

**These browser checks do not secure real data.** Anyone controlling the browser
can change session storage or JavaScript, and all synthetic fixtures are
bundled with the app. Do not deploy this client-only model for enterprise data.

For production, use these boundaries:

1. Authenticate through enterprise OIDC/SAML SSO. Resolve user, tenant, groups and
   attributes from a server-verified session, never from the perspective selector.
2. Apply deny-by-default policy combining roles with business unit, product,
   purpose and data classification. Classify the request against a governed
   metric/catalog contract; an LLM's proposed plan is not an authorization grant.
3. Authorize the plan and every discovered tool call on the server. Push approved
   predicates and row/column policies into the data platform; disallow arbitrary
   client SQL. Transcript access, aggregate counts and identifying fields need
   separate entitlements and appropriate minimum-cohort rules.
4. For a partially permitted question, state the authorized scope and limitations.
   Do not infer restricted values from totals, joins, cached answers or repeated
   questions. Deny if the remaining evidence cannot support a safe answer.
5. Bind conversations, caches, evidence, reports and review tickets to tenant,
   principal and entitlement version. Revalidate on every read, follow-up,
   export, share and assignment, including recipient access. Invalidate cached
   results when grants are revoked.
6. Store reports server-side behind authenticated links with expiry/revocation.
   Exports require a separate permission; once downloaded, copies cannot be
   revoked. Record redacted audit events for grants, denials, tool calls, exports
   and sharing without placing sensitive source content in logs.

### Modern report views, download and sharing

The report has a dedicated executive-brief toolbar, clearer KPI cards, consistent
comparison colors, and a **Change vs baseline** chart view. Changes in rate charts
are percentage points, not percentage growth; direction is not labeled good or
bad. Exact-value tables remain available alongside every chart.

- **Download HTML** creates a portable, read-only report with embedded SVG
  comparisons, exact values, confidence, findings, scripted excerpts, limitations,
  conversation context and permitted source/query provenance. No server, external
  script, font or image is required to open it.
- **Print / Save PDF** opens a dedicated printable report. Use the browser print
  dialog's Save as PDF option; this is not an automatic PDF download.
- **Share report** uses native file sharing when supported. Otherwise it starts
  the HTML download and explicitly asks the user to attach the file using an
  approved tool. Cancellation and errors do not claim successful delivery.

All demo users may export only their permitted analysis. Export, print and share
recheck the current user, conversation history and source grants. Partial reports
retain their permission warning; restricted evidence is not exported. Downloaded
files have no access control or revocation and must be shared only with authorized
recipients. Browser-local analyst-review links are not advertised as cross-user
sharing links.

The visual hierarchy and progressive detail are informed by the
[Carbon dashboard guidance](https://www.carbondesignsystem.com/building-blocks/data-visualization/dashboards);
the implementation remains original and uses the existing component libraries.
Platform behavior follows MDN's [Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
and [print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) documentation.

### Admin-managed data sources

1. Sign in as `admin` and open **Data connections**. Choose a provider card.
   The icon catalog includes Snowflake, AWS Glue, S3, Redshift, Azure Blob, ADLS,
   Data Factory, Azure SQL, Synapse, Databricks, Oracle, PostgreSQL, MySQL,
   SQL Server, BigQuery, MongoDB, files and a custom-source option.
2. Enter a name, description, capabilities, dataset aliases (such as database,
   schema, bucket, prefix or workspace), collection identifiers, candidate join
   keys and time field. Use demo metadata only, never credentials or personal data.
3. Choose access grants. New sources are admin-only unless other demo users are
   explicitly selected; their existing business-scope restrictions still apply.
4. Choose **Register data source**. The mapping is saved in this browser and appears
   in the source library and capability-matched investigation plans. Start a new
   question or follow-up to use it; reload other tabs to refresh their registry.
   **Manage connection** edits an existing registration without creating a duplicate.

**Registered does not mean connected.** Custom sources are marked **Not connected**.
The engine does not call a connector or invent evidence for them. Their absence
is included in answer limitations, confidence coverage, analyst handoffs and report
exports. A server-side adapter must be implemented before live queries are possible;
registering metadata does not create a new supported demo scenario.

Duplicate names, invalid identifiers/capabilities/grants and persistence failures
are reported without registering the source. Invalid saved registry data pauses
investigations rather than silently discarding configuration. After resolving a
storage issue, use **Reload source registry**. This console adds and edits mappings; it does
not edit built-in sources, deploy adapters, test live credentials or provide real
admin authentication. Production administration requires server-verified admin
roles, governed registry storage, secret management and audit logging.

### Business and field context

The admin **Data context** module highlights sources that still need documentation.
Use **Edit data context** to specify:

- Dataset grain, time field, timezone, business definitions and caveats.
- Each permitted field's meaning, type, role (identifier, dimension, measure or
  time), unit and approved aggregation.
- Metric names and definitions mapped to question intents and documented fields,
  with human-readable filters and population constraints.

Identifiers and dimensions cannot be summed or averaged; measures must be numeric.
The configured time field must be documented. Unknown fields, invalid timezones
and duplicate field/metric names are rejected. `NONE` means no automatic
aggregation is approved, which is important for rates and snapshot balances.

**Preview saved agent context** shows the structured guidance. When a question
selects the source, only matching metric-intent mappings are proposed, for example
`COUNT_DISTINCT(account_id)` for an openings question. Definitions and context
appear in source inspection, review handoffs and downloaded reports.
This is not SQL execution or automatic schema discovery. Actual planning must
validate the live schema, reporting scope, filters, join cardinality and permissions
on the server; no unsupported metric is inferred from free-text descriptions.

### MCP tools

The admin **MCP tools** module offers configuration templates for GitHub, GitLab,
Jira, Confluence, Slack, Notion, ServiceNow, PostgreSQL, Snowflake, Databricks,
filesystem access and **Custom MCP server**. This is an extensible template catalog,
not an exhaustive directory or a claim that vendor endpoints are available.
Icons use the existing Lucide library with provider labels and colors, not copied
vendor artwork.

Save a server purpose, supported transport, dummy endpoint or executable/arguments,
optional declared tool names, planning capabilities and access grants.
[Standard MCP transport bindings](https://modelcontextprotocol.io/specification/latest/basic/transports)
include **Streamable HTTP** and **stdio**. Remote HTTP without TLS, credentials in
URLs, query tokens and shell command strings are rejected by this demo form.
No endpoint is contacted, no subprocess starts, and no tool is discovered or run.

Data and MCP registrations persist together without overwriting each other.
Configured MCP servers can appear as **Not connected** nodes in relevant,
authorized investigation plans. Declared tool names remain unverified metadata,
not callable tools. Production use requires an authenticated backend, endpoint
and executable allowlists, secret storage, protocol-compatible discovery, tool
schema validation, per-user grants, action approval and audit logging.

## Architecture and extension points

| Responsibility | Location |
| --- | --- |
| Demo login/session shell | [src/App.tsx](src/App.tsx), [session logic](src/domain/session.ts), [login UI](src/components/DemoLogin.tsx) |
| Existing portal, dialogs and answer UI | [src/Portal.tsx](src/Portal.tsx) |
| Floating nodes, animated connections, packets, orb and canvas controls | [src/components/InvestigationCanvas.tsx](src/components/InvestigationCanvas.tsx), [canvas styles](src/components/InvestigationCanvas.css) |
| Scalable source positioning and connection geometry | [src/domain/canvas-layout.ts](src/domain/canvas-layout.ts) |
| Lazy-loaded chart | [src/components/EvidenceChart.tsx](src/components/EvidenceChart.tsx) |
| Design tokens, responsive styles, reduced motion | [src/index.css](src/index.css), [src/App.css](src/App.css) |
| Personalized questions | [src/domain/profiles.ts](src/domain/profiles.ts) |
| Source mappings and capabilities | **[src/domain/sources.ts](src/domain/sources.ts)** |
| Admin source registration, persistence and form | [src/domain/source-admin.ts](src/domain/source-admin.ts), [SourceAdmin](src/components/SourceAdmin.tsx) |
| Admin modules and connector catalog | [AdminWorkspace](src/components/AdminWorkspace.tsx), [connector templates](src/domain/connector-catalog.ts) |
| Semantic metadata validation and question mappings | [src/domain/semantics.ts](src/domain/semantics.ts), [SemanticEditor](src/components/SemanticEditor.tsx) |
| MCP configuration and persistence | [src/domain/mcp-admin.ts](src/domain/mcp-admin.ts), [McpAdmin](src/components/McpAdmin.tsx) |
| Context extraction and capability selection | [src/domain/planner.ts](src/domain/planner.ts) |
| Connector and workflow contracts | [src/domain/types.ts](src/domain/types.ts) |
| Dependency scheduler, events, cancellation, retry | [src/domain/engine.ts](src/domain/engine.ts) |
| Synthetic evidence and demo connector | [src/domain/fixtures.ts](src/domain/fixtures.ts) |
| Evidence-derived summaries and calculations | [src/domain/answers.ts](src/domain/answers.ts) |
| Demo analyst handoffs and local snapshot persistence | [src/domain/reviews.ts](src/domain/reviews.ts), [review UI](src/components/AnalystReview.tsx) |
| Demo access decisions and role grants | [src/domain/access.ts](src/domain/access.ts) |
| Permission-checked portable report generation and actions | [src/domain/report.ts](src/domain/report.ts), [report tools](src/components/ReportTools.tsx) |
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

For a disconnected demo mapping, sign in as `admin` and use **Data connections**.
To implement a working connector or extend the supported analytics in code:

1. Extend the capability and evidence contracts only when a new capability is needed.
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

The demo has no production authentication, server-side persistence, live SQL
generation, server adapters, real Jira integration, external news retrieval or
autonomous business actions.
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

Analyst-review checks cover immutable handoffs, failed and proposed sources,
saved-analysis links across reloads, browser-local review lists, invalid links,
corrupt or unavailable storage, mobile layout and accessible assignment dialogs.

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
