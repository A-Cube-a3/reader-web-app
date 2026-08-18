import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPwaService } from './createPwaService.js'

describe('createPwaService', () => {
  let environment
  let registrationOptions
  let updateServiceWorker
  let registerServiceWorker

  beforeEach(() => {
    environment = createEnvironment()
    updateServiceWorker = vi.fn().mockResolvedValue(undefined)
    registerServiceWorker = vi.fn((options) => {
      registrationOptions = options
      return updateServiceWorker
    })
  })

  it('reports offline readiness, connectivity, and prompt-based updates', async () => {
    const service = createService()
    const listener = vi.fn()
    service.subscribe(listener)

    expect(registerServiceWorker).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }))
    registrationOptions.onOfflineReady()
    expect(service.getSnapshot().offlineReady).toBe(true)
    service.dismissOfflineReady()
    expect(service.getSnapshot().offlineReady).toBe(false)

    environment.emitWindow('offline')
    expect(service.getSnapshot().online).toBe(false)
    environment.navigator.onLine = true
    environment.emitWindow('online')
    expect(service.getSnapshot().online).toBe(true)

    registrationOptions.onNeedRefresh()
    expect(service.getSnapshot().updateAvailable).toBe(true)
    await service.applyUpdate()
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
    expect(service.getSnapshot().updateAvailable).toBe(false)
    expect(listener).toHaveBeenCalled()
  })

  it('captures install availability and delegates the browser prompt', async () => {
    const service = createService()
    service.subscribe(vi.fn())
    const event = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    }

    environment.emitWindow('beforeinstallprompt', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(service.getSnapshot().installAvailable).toBe(true)
    await expect(service.install()).resolves.toBe(true)
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(service.getSnapshot().installAvailable).toBe(false)

    environment.emitWindow('appinstalled')
    expect(service.getSnapshot()).toMatchObject({ installed: true, installAvailable: false })
  })

  it('checks the service worker script before requesting an update', async () => {
    const registration = { installing: null, update: vi.fn().mockResolvedValue(undefined) }
    const service = createService()
    service.subscribe(vi.fn())
    registrationOptions.onRegisteredSW('/sw.js', registration)

    await expect(service.checkForUpdate()).resolves.toBe(true)
    expect(environment.window.fetch).toHaveBeenCalledWith('/sw.js', expect.objectContaining({
      cache: 'no-store',
    }))
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('surfaces registration failures without treating offline as an error', () => {
    const service = createService()
    service.subscribe(vi.fn())

    registrationOptions.onRegisterError(new Error('internal detail'))
    expect(service.getSnapshot().registrationError).toBe('Offline installation could not be enabled.')
    environment.emitWindow('offline')
    expect(service.getSnapshot()).toMatchObject({
      online: false,
      registrationError: 'Offline installation could not be enabled.',
    })
  })

  function createService() {
    return createPwaService({
      registerServiceWorker,
      windowObject: environment.window,
      navigatorObject: environment.navigator,
      updateIntervalMs: 100,
    })
  }
})

function createEnvironment() {
  const windowListeners = new Map()
  const documentListeners = new Map()
  const navigator = { onLine: true, standalone: false }
  const document = {
    visibilityState: 'visible',
    addEventListener(name, listener) {
      documentListeners.set(name, listener)
    },
  }
  const window = {
    document,
    fetch: vi.fn().mockResolvedValue({ ok: true }),
    matchMedia: vi.fn().mockReturnValue({ matches: false }),
    setInterval: vi.fn(),
    addEventListener(name, listener) {
      windowListeners.set(name, listener)
    },
  }
  return {
    window,
    navigator,
    emitWindow(name, event = {}) {
      windowListeners.get(name)?.(event)
    },
  }
}
