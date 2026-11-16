import { Archive, Cloud, Code2, Database, Files, Layers3, MessageSquare, Snowflake, Workflow, Wrench } from 'lucide-react'
import type { ConnectorTemplate } from '../domain/connector-catalog.ts'

const icons = { snowflake: Snowflake, database: Database, cloud: Cloud, storage: Archive, layers: Layers3, workflow: Workflow, code: Code2, messages: MessageSquare, files: Files, tools: Wrench }

export default function ConnectorIcon({ template }: { template: ConnectorTemplate }) {
  const Icon = icons[template.icon]
  return <span className="connector-icon" style={{ color: template.color, backgroundColor: `${template.color}12` }}><Icon size={27} strokeWidth={1.7} aria-hidden="true" /></span>
}
