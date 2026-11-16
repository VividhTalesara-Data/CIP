import type { InvestigationTurn } from '../domain/types.ts'

export default function ConversationHistory({ turns }: { turns: InvestigationTurn[] }) {
  if (!turns.length) return null
  return <section className="conversation-history" aria-label="Conversation history">
    <h2>Conversation so far</h2>
    <p>Previous answers and their evidence stay in this conversation. Expand a question to compare its saved answer.</p>
    {turns.map(turn => <details className="conversation-turn" key={turn.turn}>
      <summary><span>QUESTION {turn.turn}</span><strong>{turn.plan.question}</strong></summary>
      <p className="conversation-scope">{turn.plan.scope} · {turn.plan.period} · {turn.status}</p>
      {turn.answer ? <>
        <h3>{turn.answer.headline}</h3><p>{turn.answer.summary}</p>
        <p>Demo confidence: {turn.answer.confidence.score === null ? 'Not assessed' : `${turn.answer.confidence.score}%`} · {turn.evidence.length} evidence records</p>
        <dl>{turn.answer.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value} · {metric.detail}</dd></div>)}</dl>
        <ul>{turn.answer.findings.map(finding => <li key={finding.evidenceIds.join()}>{finding.text}</li>)}</ul>
        {turn.answer.highlights.map(item => <div className="conversation-highlight" key={item.evidenceId}><h4>{item.title}</h4><p>{item.observation} {item.summary}</p>{item.excerpt && <blockquote>Scripted demo excerpt, not a real transcript:<br />{item.excerpt.text}</blockquote>}<small>Evidence: {item.evidenceId} · {item.caveat}</small></div>)}
        {turn.answer.chart && <details><summary>Previous chart values: {turn.answer.chart.title}</summary><table className="data-table"><thead><tr><th>Group</th><th>Comparison</th><th>Selected period</th></tr></thead><tbody>{turn.answer.chart.rows.map(row => <tr key={row.label}><td>{row.label}</td><td>{row.baseline}</td><td>{row.current}</td></tr>)}</tbody></table></details>}
        <details><summary>Previous recommendations and limitations</summary><ul>{[...turn.answer.recommendations, ...turn.answer.limitations].map(item => <li key={item}>{item}</li>)}</ul></details>
      </> : <p>{turn.status === 'denied' ? 'Access was denied for this question. No source calls or answer were produced.' : 'This question was stopped before an answer was available. Its completed evidence remains part of the saved turn.'}</p>}
    </details>)}
  </section>
}
