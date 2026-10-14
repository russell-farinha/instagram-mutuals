import { describe, expect, it } from 'vitest'
import { accountsToCsv } from './csv'

describe('accountsToCsv', () => {
  it('quotes values and neutralizes spreadsheet formulas', () => {
    const csv = accountsToCsv([
      { username: '=SUM(1,1)', href: 'https://example.com/a"b', timestamp: 1 },
    ])
    expect(csv).toContain('"\'=SUM(1,1)"')
    expect(csv).toContain('"https://example.com/a""b"')
    expect(csv).toContain('1970-01-01T00:00:01.000Z')
  })
})
