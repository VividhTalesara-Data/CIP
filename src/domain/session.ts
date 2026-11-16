import { demoUsers } from './access.ts'
import type { DemoUser } from './access.ts'
import { isRecord } from './config-validation.ts'

export const demoSessionStorageKey = 'clarity:demo-session:v1'
export const demoPassword = 'clarity-demo'
export const demoAccounts = demoUsers.map(user => ({ user, username: user.id.replace(/^demo-/, '') }))

export function loadDemoSession(storage: () => Pick<Storage, 'getItem'>): { user: DemoUser | null; error: string } {
  try {
    const raw = storage().getItem(demoSessionStorageKey)
    if (raw === null) return { user: null, error: '' }
    const value: unknown = JSON.parse(raw)
    const user = isRecord(value) && value.version === 1 ? demoUsers.find(item => item.id === value.userId) : undefined
    if (!user) throw new Error('The saved demo session is invalid. Sign in again.')
    return { user, error: '' }
  } catch (cause) {
    return { user: null, error: `Demo session could not be restored. ${cause instanceof Error ? cause.message : 'Check browser storage permissions.'}` }
  }
}

export function signInDemo(storage: Pick<Storage, 'setItem'>, username: string, password: string): DemoUser {
  const account = demoAccounts.find(item => item.username === username.trim().toLowerCase())
  if (!account || password !== demoPassword) throw new Error('Incorrect demo username or password. Use one of the sample accounts below.')
  storage.setItem(demoSessionStorageKey, JSON.stringify({ version: 1, userId: account.user.id }))
  return account.user
}

export function signOutDemo(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(demoSessionStorageKey)
}
