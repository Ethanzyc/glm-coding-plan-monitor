import type { UsageResult } from '../shared/types';
import type { LoadedProvider } from './loader';

export interface AggregatedUsage {
  lowestPercent: number;
  results: Map<string, UsageResult>;
  lastUpdate: Date;
}

/**
 * Provider 用量数据汇总器
 * 收集所有 Provider 的结果并计算最低百分比
 */
export class UsageAggregator {
  private results = new Map<string, UsageResult>();
  private lastUpdate: Date | null = null;
  private generation = 0;

  async aggregate(providers: LoadedProvider[]): Promise<AggregatedUsage> {
    const gen = ++this.generation;
    const previousResults = new Map(this.results);

    // 单 provider 多账号：同一 provider 下串行，不同 provider 并行
    const groups = new Map<string, typeof providers>();
    for (const p of providers) {
      if (!groups.has(p.type)) groups.set(p.type, []);
      groups.get(p.type)!.push(p);
    }

    const outcomes = await Promise.all(
      Array.from(groups.entries()).map(async ([, group]) => {
        const groupResults: Array<{ compoundKey: string; result: UsageResult }> = [];
        for (const { type, accountId, instance, config } of group) {
          const compoundKey = `${type}:${accountId}`;
          try {
            const result = await instance.fetchUsage(config);
            groupResults.push({ compoundKey, result });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Aggregator] Failed to fetch ${compoundKey}:`, errMsg);
            const previous = previousResults.get(compoundKey);
            if (previous) {
              console.warn(`[Aggregator] Using previous data for ${compoundKey}`);
              previous.error = errMsg;
              groupResults.push({ compoundKey, result: previous });
            } else {
              groupResults.push({
                compoundKey,
                result: { used: 0, total: 100, expiresAt: '', error: errMsg, details: {} },
              });
            }
          }
        }
        return groupResults;
      })
    );

    // 丢弃过期结果
    if (gen !== this.generation) {
      console.log('[Aggregator] Discarding stale results (newer aggregate in progress)');
      const lowestPercent = this.calculateLowestPercent();
      return { lowestPercent, results: this.results, lastUpdate: this.lastUpdate! };
    }

    this.results.clear();
    for (const groupResults of outcomes) {
      for (const { compoundKey, result } of groupResults) {
        this.results.set(compoundKey, result);
      }
    }

    this.lastUpdate = new Date();
    const lowestPercent = this.calculateLowestPercent();

    console.log(`[Aggregator] Updated. Lowest: ${lowestPercent}%, Providers: ${this.results.size}`);

    return { lowestPercent, results: this.results, lastUpdate: this.lastUpdate };
  }

  static calcPercent(result: UsageResult): number {
    return result.total > 0 ? (result.used / result.total) * 100 : 0;
  }

  private calculateLowestPercent(): number {
    if (this.results.size === 0) return 0;
    let maxPercent = 0;
    for (const result of this.results.values()) {
      const pct = result.badgePercent ?? UsageAggregator.calcPercent(result);
      maxPercent = Math.max(maxPercent, pct);
    }
    return Math.round(maxPercent * 10) / 10;
  }

  getCurrentData(): AggregatedUsage | null {
    if (!this.lastUpdate) return null;
    return {
      lowestPercent: this.calculateLowestPercent(),
      results: new Map(this.results),
      lastUpdate: this.lastUpdate,
    };
  }

  clear(): void {
    this.results.clear();
    this.lastUpdate = null;
  }
}
