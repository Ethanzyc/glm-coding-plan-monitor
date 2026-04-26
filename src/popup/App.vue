<template>
  <div class="app">
    <Transition :name="transitionName">
      <MainView v-if="currentView === 'main'" key="main" @open-settings="goSettings" />
      <SettingsView v-else key="settings" @go-back="goMain" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MainView from './src/views/MainView.vue'
import SettingsView from './src/views/SettingsView.vue'

const { locale } = useI18n()

const currentView = ref<'main' | 'settings'>('main')
const transitionName = ref('slide-left')

function goSettings() {
  transitionName.value = 'slide-left'
  currentView.value = 'settings'
}

function goMain() {
  transitionName.value = 'slide-right'
  currentView.value = 'main'
}

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  const config = await window.chromeAPI.getConfig()
  if (config?.language) {
    locale.value = config.language
  }

  unsubscribe = window.chromeAPI.onUsageDataUpdated(() => {
    // Data updates are handled in MainView directly
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  width: 100%;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-from {
  transform: translateX(-100%);
}

.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
