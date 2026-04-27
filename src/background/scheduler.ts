import type { AppConfig, BadgeMode } from '../shared/types';
import type { LoadedProvider } from './loader';
import { UsageAggregator } from './aggregator';
import type { BadgeManager } from './badge';

const ALARM_NAME = 'glm-monitor-refresh';

/**
 * 数据刷新调度器
 * 使用 chrome.alarms API 定时触发数据刷新
 */
export class Scheduler {
  private aggregator = new UsageAggregator();
  private badgeManager: BadgeManager | null = null;
  private providers: LoadedProvider[] = [];
  private refreshInterval: number;
  private refreshing = false;
  private onRefreshed: ((data: any) => void) | null = null;

  constructor(refreshInterval: number = 300) {
    this.refreshInterval = refreshInterval;
  }

  setBadgeManager(badge: BadgeManager): void {
    this.badgeManager = badge;
  }

  setProviders(providers: LoadedProvider[]): void {
    this.providers = providers;
  }

  setOnRefreshed(cb: (data: any) => void): void {
    this.onRefreshed = cb;
  }

  setRefreshInterval(interval: number): void {
    if (this.refreshInterval === interval) return;
    this.refreshInterval = interval;
    this.restartAlarm();
  }

  setBadgeMode(mode: BadgeMode): void {
    this.aggregator.setBadgeMode(mode);
  }

  start(): void {
    console.log(`[Scheduler] Starting with interval: ${this.refreshInterval}s`);
    this.restartAlarm();
  }

  stop(): void {
    chrome.alarms.clear(ALARM_NAME);
    console.log('[Scheduler] Stopped');
  }

  private restartAlarm(): void {
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: Math.max(0.5, this.refreshInterval / 60),
      });
    });
  }

  isRefreshing(): boolean {
    return this.refreshing;
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    if (this.providers.length === 0) {
      this.aggregator.clear();
      this.badgeManager?.clear();
      this.onRefreshed?.(null);
      return;
    }

    this.refreshing = true;
    this.badgeManager?.setLoading();
    console.log('[Scheduler] Refreshing usage data...');
    const startTime = Date.now();

    try {
      const aggregated = await this.aggregator.aggregate(this.providers);
      this.badgeManager?.updateDisplay(aggregated.badgePercent);

      const elapsed = Date.now() - startTime;
      console.log(`[Scheduler] Refresh completed in ${elapsed}ms. Badge: ${aggregated.badgePercent}%`);

      this.onRefreshed?.(aggregated);
    } catch (error) {
      console.error('[Scheduler] Refresh failed:', error);
      throw error;
    } finally {
      this.refreshing = false;
    }
  }

  getAggregatedData() {
    return this.aggregator.getCurrentData();
  }
}

export function createScheduler(config: AppConfig): Scheduler {
  return new Scheduler(config.refreshInterval);
}

export { ALARM_NAME };
