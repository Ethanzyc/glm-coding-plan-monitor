import { createApp } from 'vue'
import App from './App.vue'
import i18n from './src/locales'
import type { AppConfig, UsageState } from '../shared/types'

// Chrome extension API bridge (replaces window.electronAPI)
const chromeAPI = {
  getUsageData: (): Promise<UsageState | null> =>
    chrome.runtime.sendMessage({ action: 'getUsageData' }),

  refreshUsage: (): Promise<UsageState | null> =>
    chrome.runtime.sendMessage({ action: 'refreshUsage' }),

  getConfig: (): Promise<AppConfig | null> =>
    chrome.runtime.sendMessage({ action: 'getConfig' }),

  updateConfig: (updates: Partial<AppConfig>): Promise<AppConfig | null> =>
    chrome.runtime.sendMessage({ action: 'updateConfig', updates }),

  getAvailableProviders: (): Promise<string[]> =>
    chrome.runtime.sendMessage({ action: 'getAvailableProviders' }),

  openExternal: (url: string): Promise<void> =>
    chrome.runtime.sendMessage({ action: 'openExternal', url }),

  onUsageDataUpdated: (cb: (data: UsageState) => void): (() => void) => {
    const listener = (message: { action: string; data?: unknown }) => {
      if (message.action === 'usageDataUpdated' && message.data) {
        cb(message.data as UsageState)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  },
}

declare global {
  interface Window {
    chromeAPI: typeof chromeAPI
  }
}

window.chromeAPI = chromeAPI

const app = createApp(App)
app.use(i18n)
app.mount('#app')
