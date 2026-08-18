const INITIAL_STATE = Object.freeze({
  online: true,
  offlineReady: false,
  updateAvailable: false,
  installAvailable: false,
  installed: false,
  registrationError: null,
})

export function createPwaService({
  registerServiceWorker,
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  updateIntervalMs = 60 * 60 * 1000,
} = {}) {
  let state = {
    ...INITIAL_STATE,
    online: navigatorObject?.onLine !== false,
    installed: isStandalone(windowObject, navigatorObject),
  }
  let started = false
  let installPrompt = null
  let updateServiceWorker = async () => {}
  let serviceWorkerRegistration = null
  let serviceWorkerUrl = null
  const listeners = new Set()

  function emit(changes) {
    state = { ...state, ...changes }
    for (const listener of listeners) listener()
  }

  function start() {
    if (started) return
    started = true

    windowObject?.addEventListener('online', handleOnline)
    windowObject?.addEventListener('offline', handleOffline)
    windowObject?.addEventListener('beforeinstallprompt', handleInstallPrompt)
    windowObject?.addEventListener('appinstalled', handleInstalled)
    windowObject?.document?.addEventListener('visibilitychange', handleVisibilityChange)

    if (typeof registerServiceWorker !== 'function') {
      emit({ registrationError: 'Offline installation is unavailable in this browser.' })
      return
    }

    try {
      updateServiceWorker = registerServiceWorker({
        immediate: true,
        onNeedRefresh() {
          emit({ updateAvailable: true })
        },
        onOfflineReady() {
          emit({ offlineReady: true })
        },
        onRegisteredSW(url, registration) {
          serviceWorkerUrl = url
          serviceWorkerRegistration = registration || null
        },
        onRegisterError() {
          emit({ registrationError: 'Offline installation could not be enabled.' })
        },
      })
    } catch {
      emit({ registrationError: 'Offline installation could not be enabled.' })
    }

    if (typeof windowObject?.setInterval === 'function') {
      windowObject.setInterval(checkForUpdate, updateIntervalMs)
    }
  }

  async function checkForUpdate() {
    if (
      !state.online
      || !serviceWorkerRegistration
      || serviceWorkerRegistration.installing
      || !serviceWorkerUrl
    ) return false

    try {
      const response = await windowObject.fetch(serviceWorkerUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      if (!response.ok) return false
      await serviceWorkerRegistration.update()
      return true
    } catch {
      return false
    }
  }

  function handleOnline() {
    emit({ online: true })
    void checkForUpdate()
  }

  function handleOffline() {
    emit({ online: false })
  }

  function handleInstallPrompt(event) {
    event.preventDefault()
    installPrompt = event
    emit({ installAvailable: true })
  }

  function handleInstalled() {
    installPrompt = null
    emit({ installAvailable: false, installed: true })
  }

  function handleVisibilityChange() {
    if (windowObject?.document?.visibilityState === 'visible') void checkForUpdate()
  }

  async function install() {
    if (!installPrompt) return false
    const prompt = installPrompt
    installPrompt = null
    emit({ installAvailable: false })
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      return choice?.outcome === 'accepted'
    } catch {
      return false
    }
  }

  async function applyUpdate() {
    emit({ updateAvailable: false })
    await updateServiceWorker(true)
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      start()
      return () => listeners.delete(listener)
    },
    install,
    applyUpdate,
    checkForUpdate,
    dismissOfflineReady: () => emit({ offlineReady: false }),
    dismissUpdate: () => emit({ updateAvailable: false }),
    dismissRegistrationError: () => emit({ registrationError: null }),
  }
}

function isStandalone(windowObject, navigatorObject) {
  return Boolean(
    navigatorObject?.standalone
    || windowObject?.matchMedia?.('(display-mode: standalone)')?.matches,
  )
}
