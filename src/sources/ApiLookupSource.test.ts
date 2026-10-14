import { describe, expect, it } from 'vitest'
import { sanitizeLookupUsername } from './ApiLookupSource'

describe('sanitizeLookupUsername', () => {
  it.each([
    [' @Some.One ', 'Some.One'],
    ['https://www.instagram.com/sample_name/?x=1', 'sample_name'],
    ['instagram.com/sample.name', 'sample.name'],
  ])('accepts %s', (input, expected) =>
    expect(sanitizeLookupUsername(input)).toBe(expected),
  )
  it('rejects invalid names', () =>
    expect(() => sanitizeLookupUsername('not valid!')).toThrow(
      /valid Instagram username/,
    ))
})
