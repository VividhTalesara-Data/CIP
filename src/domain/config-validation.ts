export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
export const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
export const identifier = /^[a-zA-Z_][a-zA-Z0-9_.$-]*$/

export function configText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`)
  const text = value.trim()
  if ((required && !text) || text.length > max) throw new Error(`${label} must contain ${required ? '1' : '0'}-${max} characters.`)
  return text
}
