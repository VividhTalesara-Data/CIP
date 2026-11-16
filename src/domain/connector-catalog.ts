export interface ConnectorTemplate {
  id: string
  name: string
  category: string
  description: string
  icon: 'snowflake' | 'database' | 'cloud' | 'storage' | 'layers' | 'workflow' | 'code' | 'messages' | 'files' | 'tools'
  color: string
}

export const connectorSettings: Record<string, { key: string; label: string; placeholder: string }[]> = {
  snowflake: [{ key: 'account', label: 'Account alias', placeholder: 'demo-account' }, { key: 'database', label: 'Database', placeholder: 'ANALYTICS' }, { key: 'schema', label: 'Schema', placeholder: 'GOVERNED' }, { key: 'warehouse', label: 'Warehouse', placeholder: 'REPORTING_WH' }],
  'aws-glue': [{ key: 'region', label: 'AWS region', placeholder: 'us-east-1' }, { key: 'catalog', label: 'Catalog alias', placeholder: 'demo-catalog' }, { key: 'database', label: 'Glue database', placeholder: 'customer_analytics' }],
  'aws-s3': [{ key: 'region', label: 'AWS region', placeholder: 'us-east-1' }, { key: 'bucket', label: 'Bucket name', placeholder: 'demo-analytics' }, { key: 'prefix', label: 'Object prefix', placeholder: 'curated/accounts/' }],
  redshift: [{ key: 'cluster', label: 'Cluster / workgroup alias', placeholder: 'demo-workgroup' }, { key: 'database', label: 'Database', placeholder: 'analytics' }, { key: 'schema', label: 'Schema', placeholder: 'public' }],
  'azure-blob': [{ key: 'account', label: 'Storage account', placeholder: 'demostorage' }, { key: 'container', label: 'Container', placeholder: 'analytics' }, { key: 'prefix', label: 'Blob prefix', placeholder: 'curated/' }],
  'azure-adls': [{ key: 'account', label: 'Storage account', placeholder: 'demolake' }, { key: 'filesystem', label: 'File system', placeholder: 'analytics' }, { key: 'path', label: 'Dataset path', placeholder: 'curated/accounts/' }],
  'azure-adf': [{ key: 'factory', label: 'Data factory', placeholder: 'demo-factory' }, { key: 'resourceGroup', label: 'Resource group', placeholder: 'demo-analytics' }],
  'azure-sql': [{ key: 'server', label: 'Server alias', placeholder: 'demo-sql' }, { key: 'database', label: 'Database', placeholder: 'analytics' }, { key: 'schema', label: 'Schema', placeholder: 'dbo' }],
  'azure-synapse': [{ key: 'workspace', label: 'Workspace', placeholder: 'demo-workspace' }, { key: 'database', label: 'Database', placeholder: 'analytics' }],
  databricks: [{ key: 'workspace', label: 'Workspace alias', placeholder: 'demo-workspace' }, { key: 'catalog', label: 'Catalog', placeholder: 'main' }, { key: 'schema', label: 'Schema', placeholder: 'analytics' }],
  oracle: [{ key: 'service', label: 'Service alias', placeholder: 'demo-service' }, { key: 'schema', label: 'Schema', placeholder: 'ANALYTICS' }],
  postgres: [{ key: 'database', label: 'Database', placeholder: 'demo_analytics' }, { key: 'schema', label: 'Schema', placeholder: 'public' }],
  mysql: [{ key: 'database', label: 'Database', placeholder: 'demo_analytics' }],
  'sql-server': [{ key: 'instance', label: 'Instance alias', placeholder: 'demo-instance' }, { key: 'database', label: 'Database', placeholder: 'analytics' }, { key: 'schema', label: 'Schema', placeholder: 'dbo' }],
  bigquery: [{ key: 'project', label: 'Project alias', placeholder: 'demo-project' }, { key: 'dataset', label: 'Dataset', placeholder: 'customer_analytics' }],
  mongodb: [{ key: 'database', label: 'Database', placeholder: 'demo_analytics' }],
  files: [{ key: 'dataset', label: 'Dataset alias', placeholder: 'account-events' }, { key: 'format', label: 'File format', placeholder: 'Parquet' }],
  custom: [{ key: 'locator', label: 'Dataset alias', placeholder: 'A non-secret dataset reference' }],
}

export const dataConnectors: readonly ConnectorTemplate[] = [
  { id: 'snowflake', name: 'Snowflake', category: 'Warehouse', description: 'Governed tables, views and analytical datasets.', icon: 'snowflake', color: '#237baf' },
  { id: 'aws-glue', name: 'AWS Glue', category: 'AWS', description: 'Catalog definitions and ETL dataset context.', icon: 'workflow', color: '#a65d14' },
  { id: 'aws-s3', name: 'Amazon S3', category: 'AWS', description: 'Object storage, data lake paths and file datasets.', icon: 'storage', color: '#8a6518' },
  { id: 'redshift', name: 'Amazon Redshift', category: 'AWS', description: 'Warehouse tables and reporting collections.', icon: 'database', color: '#875bb0' },
  { id: 'azure-blob', name: 'Azure Blob Storage', category: 'Azure', description: 'Containers and object-based datasets.', icon: 'storage', color: '#257cac' },
  { id: 'azure-adls', name: 'Azure Data Lake Storage', category: 'Azure', description: 'Lake datasets and their business definitions.', icon: 'layers', color: '#257cac' },
  { id: 'azure-adf', name: 'Azure Data Factory', category: 'Azure', description: 'Pipeline, lineage and integration context.', icon: 'workflow', color: '#257cac' },
  { id: 'azure-sql', name: 'Azure SQL', category: 'Azure', description: 'Relational tables and governed views.', icon: 'database', color: '#257cac' },
  { id: 'azure-synapse', name: 'Azure Synapse', category: 'Azure', description: 'Warehouse and lake analytics metadata.', icon: 'layers', color: '#5271b5' },
  { id: 'databricks', name: 'Databricks', category: 'Lakehouse', description: 'Catalog, schema and lakehouse table context.', icon: 'layers', color: '#b95236' },
  { id: 'oracle', name: 'Oracle', category: 'Database', description: 'Enterprise relational schemas and measures.', icon: 'database', color: '#b9423d' },
  { id: 'postgres', name: 'PostgreSQL', category: 'Database', description: 'Relational datasets, dimensions and metrics.', icon: 'database', color: '#32668e' },
  { id: 'mysql', name: 'MySQL', category: 'Database', description: 'Operational tables and reporting views.', icon: 'database', color: '#27718c' },
  { id: 'sql-server', name: 'SQL Server', category: 'Database', description: 'SQL schemas and analytical models.', icon: 'database', color: '#9b4847' },
  { id: 'bigquery', name: 'BigQuery', category: 'Warehouse', description: 'Analytical datasets and table definitions.', icon: 'database', color: '#3b72b5' },
  { id: 'mongodb', name: 'MongoDB', category: 'Database', description: 'Document collections and field semantics.', icon: 'files', color: '#3d8157' },
  { id: 'files', name: 'CSV / Parquet', category: 'Files', description: 'Describe file schemas without uploading real data.', icon: 'files', color: '#60753e' },
  { id: 'custom', name: 'Other data source', category: 'Custom', description: 'Register another platform and its governed context.', icon: 'tools', color: '#647078' },
]

export const mcpTemplates: readonly ConnectorTemplate[] = [
  { id: 'github', name: 'GitHub MCP', category: 'Engineering', description: 'Repository and issue tools through your chosen server.', icon: 'code', color: '#43515a' },
  { id: 'gitlab', name: 'GitLab MCP', category: 'Engineering', description: 'Project and development workflow tools.', icon: 'code', color: '#ad5c2c' },
  { id: 'jira', name: 'Jira MCP', category: 'Work management', description: 'Issue and project context from a compatible server.', icon: 'workflow', color: '#356dc0' },
  { id: 'confluence', name: 'Confluence MCP', category: 'Knowledge', description: 'Documentation and knowledge retrieval tools.', icon: 'files', color: '#356dc0' },
  { id: 'slack', name: 'Slack MCP', category: 'Collaboration', description: 'Permitted conversation and search tools.', icon: 'messages', color: '#825b8a' },
  { id: 'notion', name: 'Notion MCP', category: 'Knowledge', description: 'Workspace pages and structured knowledge tools.', icon: 'files', color: '#4d5a53' },
  { id: 'servicenow', name: 'ServiceNow MCP', category: 'Operations', description: 'Incident and service workflow tools.', icon: 'workflow', color: '#4d8053' },
  { id: 'postgres', name: 'PostgreSQL MCP', category: 'Data', description: 'Governed database tools from a compatible server.', icon: 'database', color: '#32668e' },
  { id: 'snowflake', name: 'Snowflake MCP', category: 'Data', description: 'Governed warehouse tools and metadata.', icon: 'snowflake', color: '#237baf' },
  { id: 'databricks', name: 'Databricks MCP', category: 'Data', description: 'Lakehouse metadata and permitted tool access.', icon: 'layers', color: '#b95236' },
  { id: 'filesystem', name: 'Filesystem MCP', category: 'Local tools', description: 'Approved file access through a backend-managed server.', icon: 'files', color: '#60753e' },
  { id: 'custom', name: 'Custom MCP server', category: 'Custom', description: 'Register any compatible HTTP or stdio server.', icon: 'tools', color: '#647078' },
]
