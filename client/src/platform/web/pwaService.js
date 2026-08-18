import { registerSW } from 'virtual:pwa-register'
import { createPwaService } from './createPwaService.js'

export const webPwaService = createPwaService({
  registerServiceWorker: registerSW,
})
