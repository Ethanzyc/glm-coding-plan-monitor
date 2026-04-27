<template>
  <div class="view-settings">
    <header class="header">
      <button class="icon-btn back-btn" :title="$t('settings.backBtn')" @click="$emit('go-back')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1>{{ $t('settings.title') }}</h1>
    </header>

    <div class="settings-body">
      <div class="section-label">{{ $t('settings.providerSection') }}</div>

      <div v-for="info in providerList" :key="info.key" class="settings-card">
        <div class="provider-header">
          <span class="provider-title">{{ $t(`providers.${info.key}`) }}</span>
          <button class="add-account-btn" @click="addAccount(info.key)">
            + {{ $t('settings.addAccount') }}
          </button>
        </div>

        <div v-for="(account, idx) in info.accounts" :key="account.id" class="account-item">
          <label class="toggle-row">
            <input type="checkbox" v-model="account.enabled" />
            <span class="toggle-switch"></span>
            <input
              class="account-label-input"
              v-model="account.label"
              :placeholder="$t('settings.accountLabelPlaceholder')"
            />
          </label>
          <div class="provider-body" v-if="account.enabled">
            <div class="input-group">
              <input
                :type="account.showKey ? 'text' : 'password'"
                class="form-input"
                v-model="account.apiKey"
                placeholder="API Key"
              />
              <button class="icon-btn eye-btn" @click="account.showKey = !account.showKey">
                <svg v-if="account.showKey" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="icon-btn delete-btn" :title="$t('settings.removeAccount')" @click="removeAccount(info.key, idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="info.accounts.length === 0" class="no-accounts">
          {{ $t('settings.noAccounts') }}
        </div>
      </div>

      <div class="section-label">{{ $t('settings.generalSection') }}</div>

      <div class="settings-card">
        <div class="form-group">
          <label class="form-label">{{ $t('settings.refreshInterval') }}</label>
          <select v-model="refreshInterval" class="form-select">
            <option value="60">{{ $t('settings.interval1m') }}</option>
            <option value="120">{{ $t('settings.interval2m') }}</option>
            <option value="300">{{ $t('settings.interval5m') }}</option>
            <option value="600">{{ $t('settings.interval10m') }}</option>
            <option value="1800">{{ $t('settings.interval30m') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.language') }}</label>
          <select v-model="language" class="form-select">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.theme') }}</label>
          <select v-model="themePreference" class="form-select">
            <option value="light">{{ $t('settings.themeLight') }}</option>
            <option value="dark">{{ $t('settings.themeDark') }}</option>
            <option value="auto">{{ $t('settings.themeAuto') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ $t('settings.badgeMode') }}</label>
          <select v-model="badgeMode" class="form-select">
            <option value="5h">{{ $t('settings.badgeMode5h') }}</option>
            <option value="weekly">{{ $t('settings.badgeModeWeekly') }}</option>
            <option value="off">{{ $t('settings.badgeModeOff') }}</option>
          </select>
        </div>
        <div class="toggle-group">
          <label class="toggle-row">
            <input type="checkbox" v-model="showEstimatedCost" />
            <span class="toggle-switch"></span>
            <span class="toggle-label">{{ $t('settings.showEstimatedCost') }}</span>
          </label>
        </div>
      </div>

      <div class="version-section">
        <span class="version-text">v1.0.0</span>
      </div>
    </div>

    <footer class="footer">
      <span class="save-status" :class="{ error: saveError }">{{ saveStatus }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppConfig, BadgeMode, ProviderTypeConfig, AccountConfig } from '../../../shared/types'
import { useTheme } from '../composables/useTheme'

defineEmits<{ 'go-back': [] }>()

const { t, locale } = useI18n()
const { preference: themePreference, setTheme } = useTheme()

interface AccountInfo {
  id: string
  label: string
  enabled: boolean
  apiKey: string
  showKey: boolean
}

interface ProviderInfo {
  key: string
  accounts: AccountInfo[]
}

const providerList = ref<ProviderInfo[]>([])
const refreshInterval = ref('300')
const language = ref('zh-CN')
const showEstimatedCost = ref(false)
const badgeMode = ref<BadgeMode>('5h')
const saving = ref(false)
const saveStatus = ref('')
const saveError = ref(false)
const currentConfig = ref<AppConfig | null>(null)

function generateId(): string {
  return Math.random().toString(16).slice(2, 10)
}

function addAccount(providerKey: string) {
  const provider = providerList.value.find(p => p.key === providerKey)
  if (!provider) return
  provider.accounts.push({
    id: generateId(),
    label: '',
    enabled: true,
    apiKey: '',
    showKey: false,
  })
}

function removeAccount(providerKey: string, index: number) {
  const provider = providerList.value.find(p => p.key === providerKey)
  if (!provider) return
  provider.accounts.splice(index, 1)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveConfig()
  }, 500)
}

onMounted(async () => {
  const config = await window.chromeAPI.getConfig()
  if (!config) return
  currentConfig.value = config

  const availableKeys: string[] = await window.chromeAPI.getAvailableProviders()

  providerList.value = availableKeys.map(key => {
    const providerConfig = config.providers[key] as ProviderTypeConfig | undefined
    return {
      key,
      accounts: (providerConfig?.accounts ?? []).map((account: AccountConfig) => ({
        id: account.id,
        label: account.label ?? '',
        enabled: account.enabled ?? false,
        apiKey: account.apiKey ?? '',
        showKey: false,
      })),
    }
  })

  refreshInterval.value = String(config.refreshInterval)
  language.value = config.language || locale.value
  showEstimatedCost.value = config.showEstimatedCost ?? false
  badgeMode.value = config.badgeMode ?? '5h'

  watch([providerList, refreshInterval, language, showEstimatedCost, badgeMode], () => {
    scheduleSave()
  }, { deep: true })

  watch(themePreference, (val) => {
    setTheme(val)
  })
})

async function saveConfig() {
  if (!currentConfig.value) return
  saving.value = true
  saveStatus.value = t('settings.saving')
  saveError.value = false

  const providers: Record<string, ProviderTypeConfig> = {}
  for (const info of providerList.value) {
    providers[info.key] = {
      accounts: info.accounts.map(a => ({
        id: a.id,
        label: a.label,
        enabled: a.enabled,
        apiKey: a.apiKey,
      })),
    }
  }

  try {
    await window.chromeAPI.updateConfig({
      providers,
      refreshInterval: parseInt(refreshInterval.value, 10),
      language: language.value,
      showEstimatedCost: showEstimatedCost.value,
      badgeMode: badgeMode.value,
    })
    locale.value = language.value
    saveStatus.value = t('settings.saved')
    setTimeout(() => { saveStatus.value = '' }, 2000)
  } catch (e) {
    console.error('[Settings] Save failed:', e)
    saveStatus.value = t('settings.saveFailed')
    saveError.value = true
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.view-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}

.settings-body::-webkit-scrollbar { width: 3px; }
.settings-body::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }

.settings-card {
  background: var(--bg-settings-card);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
}

.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.provider-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-heading);
}

.add-account-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px dashed var(--border-default);
  border-radius: 4px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}
.add-account-btn:hover {
  border-color: #3B82F6;
  color: #3B82F6;
}

.account-item {
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
  margin-top: 8px;
}

.account-label-input {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  outline: none;
  padding: 0 4px;
}
.account-label-input::placeholder {
  color: var(--text-tertiary);
}

.provider-body {
  margin-top: 8px;
}

.input-group {
  display: flex;
  gap: 4px;
}

.eye-btn {
  border: 1px solid var(--border-default) !important;
  padding: 4px 6px !important;
}

.delete-btn {
  border: 1px solid var(--border-default) !important;
  padding: 4px 6px !important;
  color: var(--text-tertiary);
}
.delete-btn:hover {
  color: #ef4444;
}

.no-accounts {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 8px 0;
}

.save-status { font-size: 11px; color: #4CAF50; }
.save-status.error { color: #F44336; }

.toggle-group {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.version-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  margin-top: 4px;
}

.version-text {
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
