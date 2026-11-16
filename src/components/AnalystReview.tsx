import { useRef, useState } from 'react'
import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react'
import { createReviewTicket, demoAnalysts, reviewLink, saveReviewTicket } from '../domain/reviews.ts'
import type { ReviewPriority, ReviewTicket } from '../domain/reviews.ts'
import type { Investigation } from '../domain/types.ts'

export function AnalystAssignment({ run, onCreated }: { run: Investigation; onCreated: (ticket: ReviewTicket) => void }) {
  const [analystId, setAnalystId] = useState('')
  const [question, setQuestion] = useState(run.plan.question)
  const [priority, setPriority] = useState<ReviewPriority>('Normal')
  const [error, setError] = useState('')
  const submitted = useRef(false)

  return <form className="review-form" onSubmit={event => {
    event.preventDefault()
    if (submitted.current) return
    submitted.current = true
    try {
      const ticket = createReviewTicket(run, analystId, question, priority)
      saveReviewTicket(window.localStorage, ticket)
      onCreated(ticket)
    } catch (cause) {
      submitted.current = false
      setError(`Could not save the demo review. ${cause instanceof Error ? cause.message : 'Check browser storage permissions and try again.'}`)
    }
  }}>
    <div className="notice"><ShieldCheck size={17} /><span><strong>Demo assignment only.</strong> Analysts are fictional. The ticket and analysis snapshot are saved in this browser; no Jira issue is created and no analyst is notified. Use demo information only.</span></div>
    <p className="modal-intro">Ask an analyst to validate the conclusion, explain a gap, or investigate an alternative. The current analysis is captured exactly as it is now.</p>
    <label>Assign to analyst<select required value={analystId} onChange={event => setAnalystId(event.target.value)}><option value="">Choose a sample analyst</option>{demoAnalysts.map(analyst => <option key={analyst.id} value={analyst.id}>{analyst.name} (sample) - {analyst.specialty}</option>)}</select></label>
    <label>Question for the analyst<textarea required maxLength={2000} rows={4} value={question} onChange={event => setQuestion(event.target.value)} aria-describedby="review-question-help" /></label>
    <p id="review-question-help" className="muted small-copy">Explain what you are unsure about and what needs to be answered. The original question is included separately.</p>
    <label>Priority<select value={priority} onChange={event => {
      if (event.target.value === 'Normal' || event.target.value === 'High') setPriority(event.target.value)
    }}><option>Normal</option><option>High</option></select></label>
    <div className="review-included"><strong>Automatically included</strong><p>Saved analysis link, original question, summary, confidence scores, metrics, chart values, findings, question-specific highlights and scripted excerpts, scope and dates, assumptions, source status and evidence, simulated retrieval inputs, activity log and expected review outcome.</p><p>No SQL was executed; the handoff explicitly identifies the demo fixture lookups instead.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit">Create demo review story<ArrowUpRight size={15} /></button>
  </form>
}

export function ReviewDetails({ ticket, created = false, analysisOnly = false }: { ticket: ReviewTicket; created?: boolean; analysisOnly?: boolean }) {
  const link = reviewLink(ticket.id, 'analysis', window.location.href)
  return <div className="review-details">
    {created && <div className="notice review-success" role="status"><Check size={19} /><span><strong>Demo story {ticket.key} created.</strong><br />Assigned to {ticket.assignee}.</span></div>}
    <p className="review-disclaimer">Local demo only. No real Jira issue was created and no analyst was notified. Links work only in this browser on this app address; clearing browser storage removes the ticket and snapshot.</p>
    <dl className="evidence-details">
      <div><dt>Story</dt><dd>{ticket.key} · Jira-style demo story</dd></div>
      <div><dt>Status / priority</dt><dd>To do (demo) · {ticket.priority}</dd></div>
      <div><dt>Assigned analyst</dt><dd>{ticket.assignee}</dd></div>
      <div><dt>Created (UTC)</dt><dd>{ticket.createdAt}</dd></div>
      <div><dt>Review question</dt><dd>{ticket.reviewQuestion}</dd></div>
      <div><dt>Original question</dt><dd>{ticket.originalQuestion}</dd></div>
    </dl>
    {analysisOnly
      ? <p className="review-link"><a href={reviewLink(ticket.id, 'review', window.location.href)}>View demo story {ticket.key}<ArrowUpRight size={14} /></a></p>
      : <div className="review-link"><a href={link}>Open saved analysis<ArrowUpRight size={14} /></a><label>Analysis link<input readOnly value={link} onFocus={event => event.target.select()} /></label></div>}
    <h3 className="section-heading">{analysisOnly ? 'Saved analysis snapshot' : 'Included in the analyst handoff'}</h3>
    <p className="muted">Read-only snapshot captured at assignment. Later investigations or retries do not change this handoff.</p>
    <div className="review-snapshot">{ticket.sections.map((section, index) => <details key={section.title} open={analysisOnly && index < 2}><summary>{section.title}</summary><p>{section.content}</p></details>)}</div>
  </div>
}

export function ReviewList({ tickets }: { tickets: ReviewTicket[] }) {
  return <div className="review-list">
    <p className="review-disclaimer">Saved in this browser only. These are demo assignments, not real Jira issues or analyst notifications.</p>
    {!tickets.length && <p className="muted">No demo reviews yet. Generate an analysis, then choose Assign to analyst.</p>}
    {tickets.map(ticket => <a key={ticket.id} href={reviewLink(ticket.id, 'review', window.location.href)}><strong>{ticket.key} · {ticket.headline}</strong><span>{ticket.assignee} · {ticket.priority} priority</span><span>{ticket.reviewQuestion}</span><span>Created {ticket.createdAt} · To do (demo)</span></a>)}
  </div>
}
