import { useState } from 'react'
import { Download, Printer, Share2 } from 'lucide-react'
import { buildReportHtml, reportFileName } from '../domain/report.ts'
import type { DemoUser } from '../domain/access.ts'
import type { Investigation } from '../domain/types.ts'

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ReportTools({ run, user }: { run: Investigation; user: DemoUser }) {
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const file = () => new File([buildReportHtml(run, user)], reportFileName(run), { type: 'text/html' })
  const failed = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'The report action could not finish. Please try again.')
  const start = () => { setError(''); setNotice('') }
  return <div className="report-tools">
    <div className="report-toolbar"><div><span className="report-edition">EXECUTIVE BRIEF</span><p>Question {run.turn} · {run.evidence.length} source results · {run.status === 'partial' ? 'Incomplete coverage' : 'Synthetic evidence'}</p></div><div className="report-actions" role="group" aria-label="Download and share analysis">
      <button onClick={() => {
        start()
        try { downloadFile(file()); setNotice('HTML report download started. The portable file includes visuals, evidence and limitations.') } catch (cause) { failed(cause) }
      }}><Download size={15} />Download HTML</button>
      <button onClick={() => {
        start()
        try {
          const html = buildReportHtml(run, user)
          const printView = window.open('', '_blank')
          if (!printView) throw new Error('The print view was blocked. Allow pop-ups for this app, or download the HTML report.')
          printView.opener = null
          printView.document.open()
          printView.document.write(html)
          printView.document.close()
          printView.focus()
          printView.print()
          setNotice('Print view opened. Choose Save as PDF in the print dialog to create a PDF.')
        } catch (cause) { failed(cause) }
      }}><Printer size={15} />Print / Save PDF</button>
      <button disabled={sharing} onClick={async () => {
        start()
        setSharing(true)
        try {
          const report = file()
          if (navigator.canShare?.({ files: [report] }) && navigator.share) {
            await navigator.share({ files: [report], title: 'Clarity demo analysis report' })
            setNotice('Share dialog completed. Delivery depends on the selected app.')
          } else {
            downloadFile(report)
            setNotice('Native file sharing is unavailable here. Report download started; attach the HTML file to an email or approved collaboration tool.')
          }
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === 'AbortError') setNotice('Sharing was cancelled or no share target was available. No delivery was confirmed.')
          else failed(cause)
        } finally { setSharing(false) }
      }}><Share2 size={15} />{sharing ? 'Opening share...' : 'Share report'}</button>
    </div></div>
    <p className="report-sharing-note">Export only permitted data. Share with authorized recipients; downloaded files are not access-controlled or revocable links.</p>
    {notice && <p className="report-action-status" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
