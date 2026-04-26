import type { Provider, ProviderConfig, SubscriptionInfo, UsageResult } from '../shared/types';
import { HttpClientWithRetry } from '../background/http';
import pricingConfig from './zai-pricing.json';

/**
 * 智谱 quota/limit API 响应类型
 */
interface ZhipuLimitItem {
  type: string;
  unit: number;
  number: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
  percentage: number;
  nextResetTime: number;
  usageDetails?: Array<{ modelCode: string; usage: number }>;
}

interface ZhipuQuotaResponse {
  code: number;
  data?: {
    limits: ZhipuLimitItem[];
    level?: string;
  };
  msg?: string;
  success?: boolean;
}

interface ZhipuToolUsageResponse {
  code: number;
  data?: {
    x_time: string[];
    networkSearchCount: (number | null)[];
    webReadMcpCount: (number | null)[];
    zreadMcpCount: (number | null)[];
    totalUsage: {
      totalNetworkSearchCount: number;
      totalWebReadMcpCount: number;
      totalZreadMcpCount: number;
    };
  };
  msg?: string;
  success?: boolean;
}

interface ZhipuModelUsageResponse {
  code: number;
  data?: {
    x_time: string[];
    modelCallCount: (number | null)[];
    tokensUsage: (number | null)[];
    totalUsage: {
      totalModelCallCount: number;
      totalTokensUsage: number;
    };
    modelDataList?: Array<{
      modelName: string;
      sortOrder: number;
      tokensUsage: (number | null)[];
      totalTokens: number;
    }>;
  };
  msg?: string;
  success?: boolean;
}

interface ZhipuPerformanceResponse {
  code: number;
  data?: {
    x_time: string[];
    liteDecodeSpeed: (number | null)[];
    proMaxDecodeSpeed: (number | null)[];
    liteSuccessRate: (number | null)[];
    proMaxSuccessRate: (number | null)[];
  };
  msg?: string;
  success?: boolean;
}

interface ZhipuSubscriptionItem {
  productName: string;
  status: string;
  valid: string;
  currentRenewTime: string;
  nextRenewTime: string;
  autoRenew: number;
  actualPrice: number;
  renewPrice: number;
  billingCycle: string;
}

interface ZhipuSubscriptionResponse {
  code: number;
  data?: ZhipuSubscriptionItem[];
  msg?: string;
  success?: boolean;
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toISODate(ts: number | undefined | null): string {
  if (ts == null || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function getLimitLabel(item: ZhipuLimitItem): { label: string; labelParams?: Record<string, string | number> } {
  if (item.type === 'TOKENS_LIMIT') {
    // unit=3: 小时, unit=6: 天(周额度)
    if (item.unit === 6) {
      return { label: 'quota.tokensLimitWeekly' };
    }
    return { label: 'quota.tokensLimit', labelParams: { n: item.number } };
  }
  if (item.type === 'TIME_LIMIT') {
    return { label: 'quota.mcpUsage' };
  }
  return { label: item.type };
}

function getQuotaColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage < 20) return 'green';
  if (percentage < 50) return 'yellow';
  return 'red';
}

interface ModelPricing {
  cache: number;
  input: number;
  output: number;
  tier?: string;
  note?: string;
}

const { models: MODEL_PRICING, tokenRatio: TOKEN_RATIO } = pricingConfig as {
  models: Record<string, ModelPricing>;
  tokenRatio: { cache: number; input: number; output: number };
};

function calcEstimatedCost(resp: ZhipuModelUsageResponse | null): number {
  if (!resp?.data?.modelDataList) return 0;
  let total = 0;
  for (const model of resp.data.modelDataList) {
    const pricing = MODEL_PRICING[model.modelName];
    if (!pricing) continue;
    const mTokens = model.totalTokens / 1_000_000;
    total += mTokens * (
      TOKEN_RATIO.cache * pricing.cache +
      TOKEN_RATIO.input * pricing.input +
      TOKEN_RATIO.output * pricing.output
    );
  }
  return Math.round(total * 100) / 100;
}

function calcModelRates(): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [name, p] of Object.entries(MODEL_PRICING)) {
    rates[name] = Math.round((
      TOKEN_RATIO.cache * p.cache +
      TOKEN_RATIO.input * p.input +
      TOKEN_RATIO.output * p.output
    ) * 100) / 100;
  }
  return rates;
}

const MODEL_RATES = calcModelRates();

export class ZhipuProvider implements Provider {
  name = '智谱';

  private httpClient = new HttpClientWithRetry(3, 1000);

  private getBaseUrl(config: ProviderConfig): string {
    return config._baseUrl as string;
  }

  async fetchUsage(config: ProviderConfig): Promise<UsageResult> {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      throw new Error('[Zhipu] API Key is required');
    }

    const baseUrl = this.getBaseUrl(config);
    const headers = { 'Authorization': `Bearer ${apiKey}` };

    const quotaResp = await this.httpClient.getJson<ZhipuQuotaResponse>(
      `${baseUrl}/api/monitor/usage/quota/limit`,
      headers
    );

    if (quotaResp.code !== 200 || !quotaResp.data?.limits?.length) {
      throw new Error(`[Zhipu] Quota API error: ${quotaResp.msg || 'Unknown error'}`);
    }

    const now = new Date();
    const start1d = new Date(now.getTime() - 1 * 86400000);
    const start7d = new Date(now.getTime() - 7 * 86400000);
    const start15d = new Date(now.getTime() - 15 * 86400000);
    const start30d = new Date(now.getTime() - 30 * 86400000);

    let resp1d: ZhipuModelUsageResponse | null = null;
    let resp7d: ZhipuModelUsageResponse | null = null;
    let resp30d: ZhipuModelUsageResponse | null = null;
    let toolResp1d: ZhipuToolUsageResponse | null = null;
    let toolResp7d: ZhipuToolUsageResponse | null = null;
    let toolResp30d: ZhipuToolUsageResponse | null = null;
    let perfResp7d: ZhipuPerformanceResponse | null = null;
    let perfResp15d: ZhipuPerformanceResponse | null = null;
    let perfResp30d: ZhipuPerformanceResponse | null = null;
    let subResp: ZhipuSubscriptionResponse | null = null;
    try {
      [resp1d, resp7d, resp30d, toolResp1d, toolResp7d, toolResp30d, perfResp7d, perfResp15d, perfResp30d, subResp] = await Promise.all([
        this.httpClient.getJson<ZhipuModelUsageResponse>(
          `${baseUrl}/api/monitor/usage/model-usage?startTime=${encodeURIComponent(formatDateTime(start1d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuModelUsageResponse>(
          `${baseUrl}/api/monitor/usage/model-usage?startTime=${encodeURIComponent(formatDateTime(start7d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuModelUsageResponse>(
          `${baseUrl}/api/monitor/usage/model-usage?startTime=${encodeURIComponent(formatDateTime(start30d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuToolUsageResponse>(
          `${baseUrl}/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(formatDateTime(start1d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuToolUsageResponse>(
          `${baseUrl}/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(formatDateTime(start7d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuToolUsageResponse>(
          `${baseUrl}/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(formatDateTime(start30d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuPerformanceResponse>(
          `${baseUrl}/api/monitor/usage/model-performance-day?startTime=${encodeURIComponent(formatDateTime(start7d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuPerformanceResponse>(
          `${baseUrl}/api/monitor/usage/model-performance-day?startTime=${encodeURIComponent(formatDateTime(start15d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuPerformanceResponse>(
          `${baseUrl}/api/monitor/usage/model-performance-day?startTime=${encodeURIComponent(formatDateTime(start30d))}&endTime=${encodeURIComponent(formatDateTime(now))}`,
          headers
        ),
        this.httpClient.getJson<ZhipuSubscriptionResponse>(
          `${baseUrl}/api/biz/subscription/list?pageSize=9999&pageNum=1`,
          headers
        )
      ]);
    } catch (e) {
      console.warn('[Zhipu] Failed to fetch model/tool usage:', e);
    }

    const quotas = quotaResp.data.limits.map(item => {
      const { label, labelParams } = getLimitLabel(item);
      const color = getQuotaColor(item.percentage);
      if (item.type === 'TOKENS_LIMIT') {
        const used = resp1d?.data?.totalUsage?.totalModelCallCount ?? 0;
        const total = item.percentage > 0 ? Math.round(used / (item.percentage / 100)) : 0;
        return {
          label,
          labelParams,
          used,
          total,
          usageRate: item.percentage,
          resetAt: toISODate(item.nextResetTime),
          limitType: 'tokens' as const,
          color,
          _sort: item.unit,
        };
      }
      return {
        label,
        labelParams,
        used: item.currentValue ?? 0,
        total: item.usage ?? 0,
        usageRate: item.percentage,
        resetAt: toISODate(item.nextResetTime),
        limitType: item.type === 'TIME_LIMIT' ? 'mcp' as const : undefined,
        color,
        _sort: item.unit,
      };
    });

    // Sort: tokens (unit=3 hourly) first, then tokens (unit=6 weekly), then MCP
    quotas.sort((a, b) => {
      const order = (q: typeof a) => q.limitType === 'tokens' ? 0 : 1;
      const unitOrder = (q: typeof a) => (q as any)._sort ?? 0;
      if (order(a) !== order(b)) return order(a) - order(b);
      return unitOrder(a) - unitOrder(b);
    });
    quotas.forEach(q => delete (q as any)._sort);

    const tokenLimit = quotaResp.data.limits.find(item => item.type === 'TOKENS_LIMIT' && item.unit === 3);
    const tokenQuota = tokenLimit ? quotas[quotaResp.data.limits.indexOf(tokenLimit)] : undefined;

    const hasWeeklyLimit = quotaResp.data.limits.some(
      item => item.type === 'TOKENS_LIMIT' && item.unit === 6
    );
    const subscription = this.parseSubscription(subResp, quotaResp.data.level ?? '', hasWeeklyLimit);

    // Use API's percentage directly for 5-hour quota
    const badgePercent = tokenLimit?.percentage ?? 0;

    return {
      used: tokenQuota?.used ?? 0,
      total: tokenQuota?.total ?? 0,
      expiresAt: tokenLimit ? toISODate(tokenLimit.nextResetTime) : '',
      badgePercent,
      level: quotaResp.data.level,
      details: {
        quotas,
        subscription,
        history1d: this.buildUsageHistory(resp1d),
        history7d: this.buildUsageHistory(resp7d),
        history30d: this.buildUsageHistory(resp30d),
        totalTokens1d: resp1d?.data?.totalUsage?.totalTokensUsage ?? 0,
        totalTokens7d: resp7d?.data?.totalUsage?.totalTokensUsage ?? 0,
        totalTokens30d: resp30d?.data?.totalUsage?.totalTokensUsage ?? 0,
        estimatedCost1d: calcEstimatedCost(resp1d),
        estimatedCost7d: calcEstimatedCost(resp7d),
        estimatedCost30d: calcEstimatedCost(resp30d),
        modelRates: MODEL_RATES,
        mcpHistory1d: this.buildToolHistory(toolResp1d),
        mcpHistory7d: this.buildToolHistory(toolResp7d),
        mcpHistory30d: this.buildToolHistory(toolResp30d),
        modelHistory1d: this.buildModelHistory(resp1d),
        modelHistory7d: this.buildModelHistory(resp7d),
        modelHistory30d: this.buildModelHistory(resp30d),
        performanceHistory7d: this.buildPerformanceHistory(perfResp7d),
        performanceHistory15d: this.buildPerformanceHistory(perfResp15d),
        performanceHistory30d: this.buildPerformanceHistory(perfResp30d)
      }
    };
  }

  private buildUsageHistory(resp: ZhipuModelUsageResponse | null): Array<{ date: string; used: number }> {
    if (!resp?.data?.x_time || !resp?.data?.tokensUsage) return [];

    return resp.data.x_time
      .map((time, i) => {
        const tokens = resp.data!.tokensUsage[i];
        const hasTime = time.includes(' ');
        const date = hasTime ? time.replace(' ', 'T').slice(0, 13) : time.slice(0, 10);
        return { date, used: tokens ?? 0 };
      })
      .filter(r => r.used > 0);
  }

  private buildToolHistory(resp: ZhipuToolUsageResponse | null): Array<{ date: string; search: number; webRead: number; zread: number }> {
    if (!resp?.data?.x_time) return [];

    return resp.data.x_time
      .map((time, i) => {
        const hasTime = time.includes(' ');
        const date = hasTime ? time.replace(' ', 'T').slice(0, 13) : time.slice(0, 10);
        return {
          date,
          search: resp.data!.networkSearchCount[i] ?? 0,
          webRead: resp.data!.webReadMcpCount[i] ?? 0,
          zread: resp.data!.zreadMcpCount[i] ?? 0,
        };
      })
      .filter(r => r.search > 0 || r.webRead > 0 || r.zread > 0);
  }

  private buildModelHistory(resp: ZhipuModelUsageResponse | null): Array<{ date: string; model: string; used: number }> {
    if (!resp?.data?.x_time || !resp?.data?.modelDataList) return [];

    const records: Array<{ date: string; model: string; used: number }> = [];
    for (const modelData of resp.data.modelDataList) {
      for (let i = 0; i < resp.data.x_time.length; i++) {
        const tokens = modelData.tokensUsage[i];
        if (!tokens || tokens <= 0) continue;
        const time = resp.data.x_time[i];
        const hasTime = time.includes(' ');
        const date = hasTime ? time.replace(' ', 'T').slice(0, 13) : time.slice(0, 10);
        records.push({ date, model: modelData.modelName, used: tokens });
      }
    }
    return records;
  }

  private buildPerformanceHistory(resp: ZhipuPerformanceResponse | null): Array<{
    date: string;
    liteDecodeSpeed: number;
    proMaxDecodeSpeed: number;
    liteSuccessRate: number;
    proMaxSuccessRate: number;
  }> {
    if (!resp?.data?.x_time) return [];
    return resp.data.x_time
      .map((time, i) => ({
        date: time.slice(0, 10),
        liteDecodeSpeed: resp.data!.liteDecodeSpeed[i] ?? 0,
        proMaxDecodeSpeed: resp.data!.proMaxDecodeSpeed[i] ?? 0,
        liteSuccessRate: resp.data!.liteSuccessRate[i] ?? 0,
        proMaxSuccessRate: resp.data!.proMaxSuccessRate[i] ?? 0,
      }))
      .filter(r => r.liteDecodeSpeed > 0 || r.proMaxDecodeSpeed > 0);
  }

  private parseSubscription(resp: ZhipuSubscriptionResponse | null, level: string, hasWeeklyLimit: boolean): SubscriptionInfo | undefined {
    if (!resp?.data?.length) return undefined;
    const sub = resp.data.find(s => s.status === 'VALID');
    if (!sub) return undefined;
    return {
      plan: hasWeeklyLimit ? `新 ${level.toUpperCase()}` : `老 ${level.toUpperCase()}`,
      status: sub.status,
      currentRenewTime: sub.currentRenewTime,
      nextRenewTime: sub.nextRenewTime,
      autoRenew: sub.autoRenew === 1,
      actualPrice: sub.actualPrice,
      renewPrice: sub.renewPrice,
      billingCycle: sub.billingCycle,
    };
  }
}
