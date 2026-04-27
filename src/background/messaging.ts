import type { AppConfig, ChromeMessage, UsageState, ProviderUsageData, AccountUsageData, UsageResult, QuotaItem, ProviderTypeConfig } from '../shared/types';
import type { ConfigManager } from './config';
import type { Scheduler } from './scheduler';
import type { BadgeManager } from './badge';
import { getAvailableProviderKeys } from './loader';
import buildConfig from '../../app.build';
import zhCN from '../shared/locales/zh-CN.json';
import enUS from '../shared/locales/en-US.json';

let configManager: ConfigManager | null = null;
let scheduler: Scheduler | null = null;
let badgeManager: BadgeManager | null = null;

export function setMessagingDeps(
  config: ConfigManager,
  sched: Scheduler,
  badge: BadgeManager,
): void {
  configManager = config;
  scheduler = sched;
  badgeManager = badge;
}

export function registerMessageHandlers(): void {
  chrome.runtime.onMessage.addListener(
    (message: ChromeMessage, _sender, sendResponse) => {
      switch (message.action) {
        case 'getUsageData': {
          const data = buildUsageData();
          sendResponse(data);
          return false;
        }

        case 'refreshUsage': {
          (async () => {
            try {
              await scheduler?.refresh();
              sendResponse(buildUsageData());
            } catch (error) {
              console.error('[Messaging] Refresh failed:', error);
              sendResponse(null);
            }
          })();
          return true; // async response
        }

        case 'getConfig': {
          const config = configManager?.getConfig() ?? null;
          sendResponse(config);
          return false;
        }

        case 'updateConfig': {
          (async () => {
            try {
              await configManager?.updateConfig(message.updates as Partial<AppConfig>);
              sendResponse(configManager?.getConfig() ?? null);
            } catch (error) {
              console.error('[Messaging] Update config failed:', error);
              sendResponse(null);
            }
          })();
          return true;
        }

        case 'getAvailableProviders': {
          sendResponse(getAvailableProviderKeys());
          return false;
        }

        case 'openExternal': {
          const url = message.url as string;
          if (url) chrome.tabs.create({ url });
          sendResponse(null);
          return false;
        }

        default:
          return false;
      }
    }
  );
}

function splitCompoundKey(key: string): [string, string] {
  const idx = key.indexOf(':');
  if (idx === -1) return [key, ''];
  return [key.slice(0, idx), key.slice(idx + 1)];
}

function getAccountLabel(type: string, accountId: string): string {
  const config = configManager?.getConfig();
  const providerConfig = config?.providers[type] as ProviderTypeConfig | undefined;
  return providerConfig?.accounts?.find(a => a.id === accountId)?.label ?? '';
}

function getProviderDisplayName(type: string): string {
  const lang = configManager?.getConfig()?.language ?? 'zh-CN';
  const messages = lang === 'zh-CN' ? zhCN : enUS;
  return (messages as any).providers?.[type] ?? type;
}

function hasEnabledProviders(): boolean {
  const config = configManager?.getConfig();
  if (!config) return false;
  return Object.values(config.providers).some(p => {
    const accounts = (p as ProviderTypeConfig).accounts;
    return Array.isArray(accounts) && accounts.some(a => a.enabled && a.apiKey?.trim());
  });
}

export function buildUsageData(): UsageState | null {
  if (!scheduler) return null;

  if (!hasEnabledProviders()) {
    return {
      providers: [],
      lastUpdate: new Date().toISOString(),
      overallPercent: -1,
    };
  }

  const aggregated = scheduler.getAggregatedData();
  if (!aggregated) return null;

  const grouped = new Map<string, Array<{ accountId: string; result: UsageResult }>>();
  for (const [compoundKey, result] of aggregated.results.entries()) {
    const [type, accountId] = splitCompoundKey(compoundKey);
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push({ accountId, result });
  }

  const providers: ProviderUsageData[] = [];
  for (const [type, accounts] of grouped.entries()) {
    providers.push({
      key: type,
      name: getProviderDisplayName(type),
      websiteUrl: buildConfig.providers.find(p => p.key === type)?.websiteUrl || '',
      accounts: accounts.map(({ accountId, result }) =>
        convertAccountData(type, accountId, result)
      ),
    });
  }

  return {
    providers,
    lastUpdate: aggregated.lastUpdate.toISOString(),
    overallPercent: aggregated.badgePercent,
  };
}

function convertAccountData(type: string, accountId: string, result: UsageResult): AccountUsageData {
  const d = result.details ?? {};
  return {
    id: accountId,
    label: getAccountLabel(type, accountId),
    enabled: true,
    used: result.used,
    total: result.total,
    usageRate: result.total > 0 ? Math.round((result.used / result.total) * 100 * 10) / 10 : 0,
    expiresAt: result.expiresAt,
    level: result.level,
    error: result.error,
    quotas: (d.quotas ?? []) as QuotaItem[],
    history1d: d.history1d as AccountUsageData['history1d'],
    history7d: d.history7d as AccountUsageData['history7d'],
    history30d: d.history30d as AccountUsageData['history30d'],
    totalTokens1d: d.totalTokens1d as number ?? 0,
    totalTokens7d: d.totalTokens7d as number ?? 0,
    totalTokens30d: d.totalTokens30d as number ?? 0,
    estimatedCost1d: d.estimatedCost1d as number ?? 0,
    estimatedCost7d: d.estimatedCost7d as number ?? 0,
    estimatedCost30d: d.estimatedCost30d as number ?? 0,
    mcpHistory1d: d.mcpHistory1d as AccountUsageData['mcpHistory1d'],
    mcpHistory7d: d.mcpHistory7d as AccountUsageData['mcpHistory7d'],
    mcpHistory30d: d.mcpHistory30d as AccountUsageData['mcpHistory30d'],
    modelHistory1d: d.modelHistory1d as AccountUsageData['modelHistory1d'],
    modelHistory7d: d.modelHistory7d as AccountUsageData['modelHistory7d'],
    modelHistory30d: d.modelHistory30d as AccountUsageData['modelHistory30d'],
    performanceHistory7d: d.performanceHistory7d as AccountUsageData['performanceHistory7d'],
    performanceHistory15d: d.performanceHistory15d as AccountUsageData['performanceHistory15d'],
    performanceHistory30d: d.performanceHistory30d as AccountUsageData['performanceHistory30d'],
    modelRates: d.modelRates as Record<string, number> | undefined,
    subscription: d.subscription as AccountUsageData['subscription'],
  };
}
