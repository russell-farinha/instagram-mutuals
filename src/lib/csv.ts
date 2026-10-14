import type { Account } from '../core'

function safeCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${neutralized.replace(/"/g, '""')}"`
}

export function accountsToCsv(accounts: readonly Account[]): string {
  const rows = ['Username,Profile URL,Follow date']
  for (const account of accounts) {
    const date = account.timestamp
      ? new Date(account.timestamp * 1000).toISOString()
      : ''
    rows.push([account.username, account.href, date].map(safeCell).join(','))
  }
  return `${rows.join('\r\n')}\r\n`
}
