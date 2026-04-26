import { ConfigManager } from './config';
import { ProviderLoader } from './loader';
import { Scheduler, ALARM_NAME } from './scheduler';
import { BadgeManager } from './badge';
import { setMessagingDeps, registerMessageHandlers, buildUsageData } from './messaging';
import type { AppConfig } from '../shared/types';

let configManager: ConfigManager;
let scheduler: Scheduler;
let badgeManager: BadgeManager;

async function initialize(): Promise<void> {
  console.log('[BG] Initializing...');

  // 1. 初始化配置
  configManager = new ConfigManager();
  const config = await configManager.initialize();

  // 2. 创建 Badge 管理器
  badgeManager = new BadgeManager(config.display.colorThresholds);

  // 3. 创建调度器
  scheduler = new Scheduler(config.refreshInterval);
  scheduler.setBadgeManager(badgeManager);
  scheduler.setOnRefreshed(() => {
    // 刷新完成后推送数据给所有 popup
    const data = buildUsageData();
    if (data) {
      chrome.runtime.sendMessage({ action: 'usageDataUpdated', data }).catch(() => {
        // popup 可能未打开，忽略错误
      });
    }
  });

  // 4. 加载 Provider
  const providers = ProviderLoader.loadProviders(config.providers);
  scheduler.setProviders(providers);
  console.log(`[BG] Loaded ${providers.length} provider(s)`);

  // 5. 设置消息处理
  setMessagingDeps(configManager, scheduler, badgeManager);
  registerMessageHandlers();

  // 6. 注册 alarm 监听
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      scheduler.refresh().catch((error) => {
        console.error('[BG] Scheduled refresh failed:', error);
      });
    }
  });

  // 7. 启动定时刷新
  scheduler.start();

  // 8. 监听配置变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes['glm_monitor_config']) return;
    console.log('[BG] Config changed, reloading...');
    reloadConfig();
  });

  // 9. 首次立即刷新
  scheduler.refresh().catch((error) => {
    console.error('[BG] Initial refresh failed:', error);
  });

  console.log('[BG] Initialization complete');
}

async function reloadConfig(): Promise<void> {
  try {
    const newConfig = await configManager.initialize();
    applyConfig(newConfig);
  } catch (error) {
    console.error('[BG] Failed to reload config:', error);
  }
}

function applyConfig(config: AppConfig): void {
  // 更新调度器
  scheduler.setRefreshInterval(config.refreshInterval);
  badgeManager.setThresholds(config.display.colorThresholds);

  // 重新加载 Provider
  const providers = ProviderLoader.loadProviders(config.providers);
  scheduler.setProviders(providers);
  console.log(`[BG] Reloaded ${providers.length} provider(s)`);

  // 触发刷新
  scheduler.refresh().catch((error) => {
    console.error('[BG] Refresh after config change failed:', error);
  });
}

// Service Worker 启动入口
initialize().catch((error) => {
  console.error('[BG] Initialization failed:', error);
});
