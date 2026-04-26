import type { AppConfig, ProviderTypeConfig } from '../shared/types';
import { generateAccountId } from '../shared/types';
import { getAvailableProviderKeys } from './loader';

const STORAGE_KEY = 'glm_monitor_config';

/**
 * 配置管理器
 * 使用 chrome.storage.local 存储配置（明文）
 */
export class ConfigManager {
  private config: AppConfig | null = null;

  async initialize(): Promise<AppConfig> {
    try {
      this.config = await this.load();
      console.log('[Config] Loaded configuration');
    } catch (error) {
      console.log('[Config] No existing config found, creating default');
      await this.createDefaultConfig();
    }
    return this.config!;
  }

  private async load(): Promise<AppConfig> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!raw) throw new Error('No config found');

    const config = JSON.parse(raw) as AppConfig;
    this.config = config;

    let migrated = false;

    // 迁移：旧格式 { enabled, apiKey } → 新格式 { accounts: [...] }
    for (const [key, val] of Object.entries(this.config.providers)) {
      if (val && typeof (val as any).apiKey === 'string' && !Array.isArray((val as any).accounts)) {
        const old = val as any;
        (this.config.providers as any)[key] = {
          accounts: [{
            id: generateAccountId(),
            enabled: old.enabled ?? false,
            apiKey: old.apiKey ?? '',
            label: '',
          }]
        };
        migrated = true;
        console.log(`[Config] Migrated: converted provider "${key}" to multi-account format`);
      }
    }

    // 迁移：补齐编译时可用但配置文件中缺失的 provider
    for (const key of getAvailableProviderKeys()) {
      if (!this.config.providers[key]) {
        (this.config.providers as any)[key] = { accounts: [] };
        migrated = true;
        console.log(`[Config] Migrated: added missing provider "${key}"`);
      }
    }

    if (migrated) {
      await this.save(this.config);
    }

    return this.config;
  }

  async save(config: AppConfig): Promise<void> {
    this.config = config;
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(config) });
    console.log('[Config] Saved configuration');
  }

  private async createDefaultConfig(): Promise<void> {
    const providers: Record<string, ProviderTypeConfig> = {};
    for (const key of getAvailableProviderKeys()) {
      providers[key] = { accounts: [] };
    }

    const defaultConfig: AppConfig = {
      refreshInterval: 300,
      providers,
      display: {
        colorThresholds: {
          green: 50,
          yellow: 20
        }
      },
      language: 'zh-CN',
      theme: 'auto',
    };

    await this.save(defaultConfig);
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    if (!this.config) throw new Error('Config not initialized');

    const mergedProviders = { ...this.config.providers };
    if (updates.providers) {
      for (const [key, value] of Object.entries(updates.providers)) {
        mergedProviders[key] = {
          ...mergedProviders[key],
          ...value
        };
      }
    }

    const newConfig: AppConfig = {
      ...this.config,
      ...updates,
      providers: mergedProviders,
      display: {
        ...this.config.display,
        ...updates.display,
        colorThresholds: {
          ...this.config.display.colorThresholds,
          ...updates.display?.colorThresholds
        }
      }
    };

    await this.save(newConfig);
  }
}
