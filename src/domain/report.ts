import { authorizePlan, canUseSource } from './access.ts'
import type { DemoUser } from './access.ts'
import { sources } from './sources.ts'
import { describeSourceContext } from './semantics.ts'
import type { Answer, Confidence, Investigation } from './types.ts'

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const number = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('The report contains an invalid numeric value and cannot be exported.')
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
const confidence = (value: Confidence) => value.score === null ? 'Not assessed' : `${number(value.score)}%`
const list = (items: string[]) => `<ul>${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`

function chartHtml(chart: NonNullable<Answer['chart']>) {
  const values = chart.rows.flatMap(row => [row.baseline, row.current])
  values.forEach(number)
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const x = (value: number) => 150 + (value - min) / (max - min) * 490
  const zero = x(0)
  const graphic = chart.rows.map((row, index) => {
    const y = index * 66 + 18
    const bar = (value: number, offset: number, color: string) => `<rect x="${Math.min(zero, x(value))}" y="${y + offset}" width="${Math.abs(x(value) - zero)}" height="14" rx="3" fill="${color}"/><text x="654" y="${y + offset + 12}">${number(value)}</text>`
    return `<text x="0" y="${y + 12}">${escape(row.label)}</text>${bar(row.baseline, 0, '#708f7d')}${bar(row.current, 20, '#355e48')}`
  }).join('')
  return `<section id="comparison"><h2>${escape(chart.title)}</h2><p>Unit: ${escape(chart.unit)}. Pale bars: comparison; dark bars: selected period.</p>
    <svg role="img" aria-label="${escape(chart.title)}. Exact values follow in the table." viewBox="0 0 760 ${chart.rows.length * 66 + 16}">${graphic}</svg>
    <table><thead><tr><th>Group</th><th>Comparison</th><th>Selected period</th><th>Change${chart.unit === '%' ? ' (pp)' : ''}</th></tr></thead><tbody>${chart.rows.map(row => `<tr><td>${escape(row.label)}</td><td>${number(row.baseline)}</td><td>${number(row.current)}</td><td>${row.current > row.baseline ? '+' : ''}${number(row.current - row.baseline)}</td></tr>`).join('')}</tbody></table><p class="meta">Evidence: ${escape(chart.evidenceId)} · Demo confidence: ${confidence(chart.confidence)}</p></section>`
}

export function reportFileName(run: Investigation) {
  return `clarity-analysis-${run.id.replace(/[^a-zA-Z0-9-]/g, '')}-q${run.turn}.html`
}

export function buildReportHtml(run: Investigation, user: DemoUser): string {
  if (!run.answer || !['complete', 'partial'].includes(run.status)) throw new Error('A completed or partial answer is required before exporting.')
  for (const turn of [run, ...run.turns]) {
    if (turn.access.principalId !== user.id ||
      (turn.answer && authorizePlan(turn.plan, user).status === 'denied') ||
      turn.evidence.some(item => !canUseSource(user, item.sourceId)) ||
      turn.nodes.some(node => node.sourceId && !canUseSource(user, node.sourceId))) {
      throw new Error('This report is outside the current demo user grants. Start an authorized investigation before exporting.')
    }
  }
  const { answer, plan } = run
  const coverage = run.nodes.filter(node => node.kind === 'source').length + run.access.excludedSourceCount
  const sourceHtml = run.nodes.filter(node => node.kind === 'source').map(node => {
    if (!node.sourceId) throw new Error('A report source is missing its identifier.')
    const source = sources[node.sourceId]
    const item = run.evidence.find(evidence => evidence.id === node.evidenceId)
    return `<article class="source"><h3>${escape(source.name)} <span class="tag">${escape(node.status)}</span></h3><p>${escape(source.platform)} · ${escape(node.purpose)}</p>
      <p>${source.connectionKind === 'mcp' ? 'Declared tools (not discovered)' : 'Placeholder collections'}: ${escape(source.collections.join(', '))}</p>${source.connectionKind === 'mcp' ? '<p>Server tools have not been discovered or executed.</p>' : `<p>Candidate join keys: ${escape(source.joinKeys.join(', '))}; availability does not prove a valid join.<br>Time field: ${escape(source.timeField)} / ${escape(source.semanticContext?.timezone ?? 'UTC')}</p>`}
      <p>${node.reused ? 'Compatible evidence reused; no new connector call.' : node.status === 'unconfigured' ? 'Registered but not connected; no connector call was made.' : node.status === 'planned' ? 'Proposed source only; retrieval was not executed.' : node.status === 'error' ? 'Simulated connector failed; no evidence was returned.' : 'Simulated retrieval only; no SQL or external query was executed.'}</p>
      <pre>${escape(JSON.stringify({ sourceId: source.id, scenario: plan.scenario, scope: plan.scope, period: plan.period, comparison: plan.comparison, connectionProperties: source.connectionProperties }, null, 2))}</pre>
      ${source.semanticContext ? `<h4>Governed data context</h4><pre>${escape(describeSourceContext(source, plan))}</pre>` : ''}
      ${item ? `<p><strong>${escape(item.finding)}</strong></p><p>Definition: ${escape(item.definition)}<br>Grain: ${escape(item.grain)} · Unit: ${escape(item.unit)}<br>Snapshot: ${escape(item.retrievedAt)}</p>
        <table><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>${Object.entries(item.values).map(([key, value]) => `<tr><td>${escape(key)}</td><td>${number(value)}</td></tr>`).join('')}</tbody></table>
        ${item.rows.length ? `<table><thead><tr><th>Group</th><th>Comparison</th><th>Selected period</th></tr></thead><tbody>${item.rows.map(row => `<tr><td>${escape(row.label)}</td><td>${number(row.baseline)}</td><td>${number(row.current)}</td></tr>`).join('')}</tbody></table>` : ''}<p>${escape(item.caveat)}</p>`
        : `<p>${escape(node.error ?? node.finding ?? 'No evidence was retrieved from this source.')}</p>`}</article>`
  }).join('')
  const highlights = answer.highlights.map(item => `<article><span class="tag">${escape(item.category)} · SYNTHETIC</span><h3>${escape(item.title)}</h3><p><strong>${escape(item.observation)}</strong></p><p>${escape(item.summary)}</p>
    ${item.excerpt ? `<blockquote><strong>Scripted demo excerpt - not a real transcript or representative sample</strong><p>${escape(item.excerpt.label)}</p><p class="preserve">${escape(item.excerpt.text)}</p></blockquote>` : ''}
    <p class="meta">${escape(item.caveat)}<br>Evidence: ${escape(item.evidenceId)} · Demo confidence: ${confidence(item.confidence)}</p></article>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>${escape(answer.headline)} | Clarity demo report</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f6f1;color:#233b2c;font:15px/1.75 system-ui,-apple-system,sans-serif}
main{max-width:1020px;margin:35px auto;background:#fff;padding:42px;border:1px solid #d5e0d0;border-radius:18px}
header{border-top:5px solid #355e48;padding-top:20px}h1{font:normal 38px/1.2 Georgia,serif;letter-spacing:-.7px;margin:14px 0}h2{font-size:22px;line-height:1.4;margin:0 0 15px}h3{font-size:17px;line-height:1.5;margin:10px 0}
p{margin:10px 0}.eyebrow,.meta{font-size:12px;color:#50674f}.eyebrow{font-weight:700;letter-spacing:1.2px}nav{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0}a{color:#355e48}
section{margin-top:30px;padding-top:25px;border-top:1px solid #dce6d7}.notice{padding:16px;border:1px solid #becead;border-radius:10px;background:#eff5e9}.warning{background:#fff4de;border-color:#d8bc7a;color:#644d19}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:22px 0}.kpi{border:1px solid #d5e0d0;border-radius:10px;padding:18px}.kpi strong{display:block;font-size:34px;line-height:1.5}.tag{display:inline-block;padding:3px 7px;background:#edf3e7;border-radius:4px;font-size:11px;color:#355e48}
article{padding:20px;border:1px solid #d9e3d3;border-radius:10px;margin:15px 0;break-inside:avoid}blockquote{margin:16px 0;padding:15px;border-left:3px solid #87a477;background:#f3f6ef}
.preserve,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font-size:11px;line-height:1.7;background:#f6f8f3;padding:12px}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th,td{padding:9px;border-bottom:1px solid #dbe4d5;text-align:left;overflow-wrap:anywhere}th{background:#eef4e8}svg{width:100%;height:auto;display:block}svg text{font:12px system-ui;fill:#35543f}
li{margin:8px 0}footer{margin-top:30px;padding-top:20px;border-top:1px solid #dce6d7;font-size:12px;color:#50674f}
@media(max-width:600px){main{margin:0;padding:22px;border:0;border-radius:0}h1{font-size:29px}.kpis{grid-template-columns:1fr}article{padding:14px}}
@media print{@page{size:A4;margin:14mm}body{background:#fff;font-size:11px}main{border:0;padding:0;margin:0;max-width:none}h1{font-size:27px}nav{display:none}section{margin-top:18px;padding-top:16px}article{break-inside:auto}.kpi,blockquote,svg,header{break-inside:avoid}thead{display:table-header-group}a{text-decoration:none;color:inherit}}
</style></head><body><main>
<header><span class="eyebrow">CLARITY / EXECUTIVE BRIEF / DEMO</span><h1>${escape(answer.headline)}</h1><p>${escape(answer.summary)}</p>
<p class="meta">Conversation ${escape(run.id)} · Question ${run.turn} · Exported ${escape(new Date().toISOString())}<br>${escape(plan.scope)} · ${escape(plan.period)} versus ${escape(plan.comparison)} · UTC</p>
<div class="notice"><strong>Synthetic demonstration.</strong> No live enterprise systems, SQL queries or language-model provider were used. Demo confidence is not a calibrated probability of correctness. Share only with authorized recipients; downloaded copies cannot be revoked.</div>
${run.access.status === 'partial' ? `<p class="notice warning"><strong>Limited-access answer.</strong> ${run.access.excludedSourceCount} sources were omitted by demo grants. Conclusions cover only the permitted evidence.</p>` : ''}
${plan.scenario === 'unsupported' ? '<p class="notice warning">Proposed investigation only. No supported analytic result is available for this question.</p>' : ''}
<nav aria-label="Report sections"><a href="#overview">Overview</a>${answer.chart ? '<a href="#comparison">Comparison</a>' : ''}<a href="#findings">Evidence</a><a href="#sources">Sources</a></nav></header>
<section id="overview"><h2>The question</h2><p>${escape(plan.question)}</p><p><strong>Demo confidence: ${confidence(answer.confidence)}</strong><br>${escape(answer.confidence.explanation)}</p><p>${run.evidence.length} of ${coverage} selected sources returned evidence.</p>
<div class="kpis">${answer.metrics.map(metric => `<div class="kpi"><span>${escape(metric.label)}</span><strong>${escape(metric.value)}</strong><p>${escape(metric.detail)}</p><span class="tag">Demo confidence: ${confidence(metric.confidence)}</span><p class="meta">Evidence: ${escape(metric.evidenceId)}</p></div>`).join('')}</div></section>
${answer.chart ? chartHtml(answer.chart) : ''}
<section id="findings"><h2>What the evidence tells us</h2>${answer.findings.length ? answer.findings.map(finding => `<article><span class="tag">${escape(finding.strength)} · Demo confidence: ${confidence(finding.confidence)}</span><p>${escape(finding.text)}</p><p class="meta">Evidence: ${escape(finding.evidenceIds.join(', '))}</p></article>`).join('') : '<p>No supported findings were generated.</p>'}${highlights}</section>
<section><h2>Recommended next steps</h2>${list(answer.recommendations)}<h2>Scope and limitations</h2>${list([...plan.assumptions, ...answer.limitations])}</section>
${run.turns.length ? `<section><h2>Conversation context: earlier answers</h2>${run.turns.map(turn => `<article><h3>Question ${turn.turn}: ${escape(turn.plan.question)}</h3><p class="meta">${escape(turn.plan.scope)} · ${escape(turn.plan.period)}</p><p>${escape(turn.answer?.headline ?? 'No completed answer.')}</p><p>${escape(turn.answer?.summary ?? turn.access.message)}</p></article>`).join('')}</section>` : ''}
<section id="sources"><h2>Sources and retrieval provenance</h2>${sourceHtml || '<p>No source retrievals were performed.</p>'}</section>
<footer>Clarity demo report · Read-only exported snapshot · No external scripts, fonts or assets are required. This file is not an authenticated sharing link.</footer>
</main></body></html>`
}
