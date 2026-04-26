<template>
  <div class="view-main">
    <header class="header">
      <h1>{{ $t('main.title') }}</h1>
      <div class="header-actions">
        <button class="icon-btn" :title="$t('main.toggleTheme')" @click="toggleTheme">
          <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <button class="icon-btn" :title="$t('main.settingsBtn')" @click="$emit('open-settings')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="icon-btn" :title="$t('main.refreshBtn')" :disabled="loading" :class="{ spinning: loading }" @click="handleRefresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="main-body">
      <template v-if="initialLoading">
        <div class="skeleton-group">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
      </template>
      <template v-else-if="providers.length === 0">
        <div class="empty-state">
          <p>{{ $t('main.emptyState') }}</p>
          <p class="hint">{{ $t('main.emptyHint') }}</p>
        </div>
      </template>

      <template v-else>
        <div class="provider-section">
          <div class="provider-name-row">
            <span class="provider-name" :class="{ clickable: !!activeProvider?.websiteUrl }" @click="openProviderWebsite(activeProvider?.websiteUrl)">{{ activeProvider?.name }}</span>
            <div v-if="activeProvider && activeProvider.accounts.length > 1" class="account-tabs" @wheel.passive="onTabsWheel">
              <button
                v-for="(acc, idx) in activeProvider.accounts"
                :key="acc.id"
                class="account-tab"
                :class="{ active: getActiveAccountId() === acc.id }"
                @click="setActiveAccount(acc.id)"
              >
                {{ acc.label || $t('main.defaultAccountLabel', { n: idx + 1 }) }}
              </button>
            </div>
            <FloatingTooltip v-if="getActiveAccount()?.level" position="bottom" align="right" :rows="getSubRows(getActiveAccount()!.subscription)">
              <span class="provider-level">{{ getActiveAccount()!.level }}</span>
            </FloatingTooltip>
          </div>

          <template v-if="getActiveAccount()">
            <div v-if="getActiveAccount()!.error" class="error-card">
              <span class="error-icon">!</span>
              <span class="error-text">{{ formatError(getActiveAccount()!.error!) }}</span>
            </div>
            <template v-else>
              <ZhipuSection :account="getActiveAccount()!" />
            </template>
          </template>
        </div>
      </template>
    </div>

    <footer class="footer">
      <span>{{ lastUpdateText }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import FloatingTooltip from '../components/FloatingTooltip.vue'
import ZhipuSection from '../components/ZhipuSection.vue'
import type { ProviderUsageData, AccountUsageData, UsageState } from '../../../shared/types'
import { useTheme } from '../composables/useTheme'

defineEmits<{ 'open-settings': [] }>()

const { t, locale } = useI18n()
const { isDark, toggleTheme } = useTheme()

const providers = ref<ProviderUsageData[]>([])
const lastUpdate = ref('')
const loading = ref(false)
const initialLoading = ref(true)
const now = ref(Date.now())

const STORAGE_KEY_ACCOUNTS = 'active-accounts'

const activeAccounts = ref<Record<string, string>>({})

function saveActiveAccounts() {
  try { localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(activeAccounts.value)) } catch {}
}

function restoreActiveAccounts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS)
    if (saved) activeAccounts.value = JSON.parse(saved)
  } catch {}
}

const activeProvider = computed(() => {
  return providers.value.length > 0 ? providers.value[0] : undefined
})

function getActiveAccountId(): string {
  if (!activeProvider.value) return ''
  return activeAccounts.value[activeProvider.value.key] || (activeProvider.value.accounts[0]?.id ?? '')
}

function getActiveAccount(): AccountUsageData | undefined {
  if (!activeProvider.value) return undefined
  const id = getActiveAccountId()
  return activeProvider.value.accounts.find(a => a.id === id) || activeProvider.value.accounts[0]
}

function setActiveAccount(accountId: string): void {
  if (!activeProvider.value) return
  activeAccounts.value[activeProvider.value.key] = accountId
  saveActiveAccounts()
}

const lastUpdateText = computed(() => {
  if (!lastUpdate.value) return t('main.lastUpdateFallback')
  try {
    const date = new Date(lastUpdate.value)
    const diffMins = Math.floor((now.value - date.getTime()) / 60000)
    if (diffMins < 1) return t('main.justNow')
    if (diffMins < 60) return t('main.minutesAgo', { n: diffMins })
    if (diffMins < 1440) return t('main.hoursAgo', { n: Math.floor(diffMins / 60) })
    return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  } catch { return lastUpdate.value }
})

function applyState(state: UsageState) {
  providers.value = state.providers
  lastUpdate.value = state.lastUpdate
  initialLoading.value = false
  restoreActiveAccounts()
}

async function fetchData() {
  try {
    const state = await window.chromeAPI.getUsageData()
    if (state) applyState(state)
  } catch (e) { console.error('[MainView] fetch failed:', e) }
}

async function handleRefresh() {
  loading.value = true
  try {
    const state = await window.chromeAPI.refreshUsage()
    if (state) applyState(state)
  } catch (e) { console.error('[MainView] refresh failed:', e) }
  finally { loading.value = false }
}

function formatError(msg: string): string {
  return msg.replace(/^\[[\w]+\]\s*/, '')
}

function openProviderWebsite(url?: string) {
  if (url) window.chromeAPI.openExternal(url)
}

function getSubRows(sub: AccountUsageData['subscription']) {
  if (!sub) return []
  return [
    { label: t('subscription.plan'), value: sub.plan },
    { label: t('subscription.subDate'), value: sub.currentRenewTime },
    { label: t('subscription.nextRenew'), value: sub.nextRenewTime },
    { label: t('subscription.autoRenew'), value: sub.autoRenew ? t('subscription.yes') : t('subscription.no') },
    { label: t('subscription.actualPrice'), value: String(sub.actualPrice) },
    { label: t('subscription.renewPrice'), value: String(sub.renewPrice) },
  ]
}

function onTabsWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement
  el.scrollLeft += e.deltaY
}

let timeInterval: ReturnType<typeof setInterval> | null = null
let unsubscribe: (() => void) | null = null

timeInterval = setInterval(() => { now.value = Date.now() }, 60000)

onMounted(async () => {
  fetchData()

  unsubscribe = window.chromeAPI.onUsageDataUpdated((data) => {
    if (data) applyState(data)
  })
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  unsubscribe?.()
})
</script>

<style scoped>
.view-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.main-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}

.main-body::-webkit-scrollbar { width: 3px; }
.main-body::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
.main-body:hover::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); }

.provider-section {
  margin-bottom: 10px;
}

.provider-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}

.provider-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-heading);
  white-space: nowrap;
}
.provider-name.clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}
.provider-name.clickable:hover {
  opacity: 0.8;
}

.account-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.account-tabs::-webkit-scrollbar {
  display: none;
}

.account-tab {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  line-height: 1;
}
.account-tab:hover {
  border-color: var(--border-default);
}
.account-tab.active {
  color: var(--text-heading);
  font-weight: 600;
  border-color: var(--border-default);
}

.provider-level {
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #555;
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  line-height: 1;
  cursor: default;
}

.provider-name-row > .ft-wrapper {
  margin-left: auto;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 24px 12px;
  color: var(--text-empty);
}
.empty-state p { margin-bottom: 4px; }
.empty-state .hint { font-size: 11px; color: var(--text-empty-hint); }

.error-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-error);
  border: 1px solid var(--border-error);
  border-radius: 8px;
  margin-bottom: 6px;
}

.error-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-text {
  font-size: 12px;
  color: var(--text-error);
  line-height: 1.4;
}

.skeleton-group {
  padding: 4px 0;
}

.skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--skeleton-a) 25%, var(--skeleton-b) 50%, var(--skeleton-a) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-title {
  width: 60px;
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-card {
  height: 68px;
  margin-bottom: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.spinning svg {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
