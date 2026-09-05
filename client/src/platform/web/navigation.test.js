import { describe, expect, it, vi } from 'vitest'
import { createWebNavigation, readBookId } from './navigation.js'

describe('web reader navigation', () => {
  it('accepts only UUID-shaped reader paths', () => {
    expect(readBookId('/read/123e4567-e89b-12d3-a456-426614174000'))
      .toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(readBookId('/read/------------------------------------')).toBeNull()
    expect(readBookId('/read/../../secret')).toBeNull()
  })

  it('publishes local reader and library navigation', () => {
    const listeners = new Map()
    const windowObject = {
      location: { pathname: '/' },
      history: {
        pushState: vi.fn((_, __, path) => { windowObject.location.pathname = path }),
      },
      addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
      removeEventListener: vi.fn(),
    }
    const navigation = createWebNavigation(windowObject)
    const listener = vi.fn()
    navigation.subscribe(listener)

    navigation.openReader('123e4567-e89b-12d3-a456-426614174000')
    expect(navigation.getSnapshot()).toBe('123e4567-e89b-12d3-a456-426614174000')
    navigation.openLibrary()
    expect(navigation.getSnapshot()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
