import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearToken, getToken, setToken } from './tokenStore'

afterEach(() => {
  clearToken()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('tokenStore', () => {
  it('uses memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setToken('temporary', true)
    expect(getToken()).toBe('temporary')
  })

  it('only persists when asked to remember', () => {
    setToken('temporary', false)
    expect(localStorage.getItem('mutuals.apify-token')).toBeNull()
    setToken('temporary', true)
    expect(getToken()).toBe('temporary')
  })
})
