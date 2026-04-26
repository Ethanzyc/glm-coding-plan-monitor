import type { UsageResult } from '../shared/types';
import pricingConfig from '../providers/zai-pricing.json';

const { models: MODEL_PRICING, tokenRatio: TOKEN_RATIO } = pricingConfig as {
  models: Record<string, { cache: number; input: number; output: number }>;
  tokenRatio: { cache: number; input: number; output: number };
};

function calcMockModelRates(): Record<string, number> {
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

function calcMockEstimatedCost(totalTokens: number): number {
  const avgRate = Object.values(MODEL_PRICING)
    .reduce((sum, p) => sum + TOKEN_RATIO.cache * p.cache + TOKEN_RATIO.input * p.input + TOKEN_RATIO.output * p.output, 0)
    / Object.keys(MODEL_PRICING).length;
  return Math.round(totalTokens / 1_000_000 * avgRate * 100) / 100;
}

const HOUR = 3600000;
const DAY = 86400000;

function generateHourlyHistory(hours: number): { date: string; used: number }[] {
  const records: { date: string; used: number }[] = [];
  const now = new Date();
  const start = new Date(now.getTime() - hours * HOUR);
  start.setMinutes(0, 0, 0);
  for (let t = start.getTime(); t <= now.getTime(); t += HOUR) {
    records.push({ date: new Date(t).toISOString().slice(0, 13), used: Math.round(10000 + Math.random() * 40000) });
  }
  return records;
}

function generateDailyHistory(days: number): { date: string; used: number }[] {
  const records: { date: string; used: number }[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    records.push({ date: d.toISOString().slice(0, 10), used: Math.round(200000 + Math.random() * 800000) });
  }
  return records;
}

function generateHourlyMcpHistory(hours: number): { date: string; search: number; webRead: number; zread: number }[] {
  const records: { date: string; search: number; webRead: number; zread: number }[] = [];
  const now = new Date();
  const start = new Date(now.getTime() - hours * HOUR);
  start.setMinutes(0, 0, 0);
  for (let t = start.getTime(); t <= now.getTime(); t += HOUR) {
    records.push({
      date: new Date(t).toISOString().slice(0, 13),
      search: Math.round(Math.random() * 15),
      webRead: Math.round(Math.random() * 8),
      zread: Math.round(Math.random() * 3)
    });
  }
  return records;
}

function generateDailyMcpHistory(days: number): { date: string; search: number; webRead: number; zread: number }[] {
  const records: { date: string; search: number; webRead: number; zread: number }[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    records.push({
      date: d.toISOString().slice(0, 10),
      search: Math.round(20 + Math.random() * 80),
      webRead: Math.round(5 + Math.random() * 30),
      zread: Math.round(Math.random() * 10)
    });
  }
  return records;
}

function generateHourlyModelHistory(hours: number): { date: string; model: string; used: number }[] {
  const models = ['GLM-5.1', 'GLM-5-Turbo', 'GLM-4.7'];
  const records: { date: string; model: string; used: number }[] = [];
  const now = new Date();
  const start = new Date(now.getTime() - hours * HOUR);
  start.setMinutes(0, 0, 0);
  for (let t = start.getTime(); t <= now.getTime(); t += HOUR) {
    const dateStr = new Date(t).toISOString().slice(0, 13);
    for (const model of models) {
      if (Math.random() > 0.3) {
        records.push({ date: dateStr, model, used: Math.round(5000 + Math.random() * 20000) });
      }
    }
  }
  return records;
}

function generateDailyModelHistory(days: number): { date: string; model: string; used: number }[] {
  const models = ['GLM-5.1', 'GLM-5-Turbo', 'GLM-4.7'];
  const records: { date: string; model: string; used: number }[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const dateStr = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    for (const model of models) {
      records.push({ date: dateStr, model, used: Math.round(50000 + Math.random() * 200000) });
    }
  }
  return records;
}

function generatePerformanceHistory(days: number): { date: string; liteDecodeSpeed: number; proMaxDecodeSpeed: number; liteSuccessRate: number; proMaxSuccessRate: number }[] {
  const records: { date: string; liteDecodeSpeed: number; proMaxDecodeSpeed: number; liteSuccessRate: number; proMaxSuccessRate: number }[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    records.push({
      date: d.toISOString().slice(0, 10),
      liteDecodeSpeed: Math.round(60 + Math.random() * 40),
      proMaxDecodeSpeed: Math.round(30 + Math.random() * 30),
      liteSuccessRate: +(0.85 + Math.random() * 0.14).toFixed(2),
      proMaxSuccessRate: +(0.8 + Math.random() * 0.18).toFixed(2)
    });
  }
  return records;
}

export function generateMockData(): Record<string, UsageResult> {
  const now = Date.now();
  const totalTokens1d = Math.round(500000 + Math.random() * 500000);
  const totalTokens7d = Math.round(3000000 + Math.random() * 3000000);
  const totalTokens30d = Math.round(10000000 + Math.random() * 10000000);

  return {
    zhipu: {
      used: 250000,
      total: 1000000,
      expiresAt: new Date(now + 5 * HOUR).toISOString(),
      level: 'pro',
      details: {
        subscription: {
          plan: '老 Pro',
          status: 'VALID',
          currentRenewTime: '2026-03-03',
          nextRenewTime: '2027-03-03',
          autoRenew: true,
          actualPrice: 2400,
          renewPrice: 2400,
          billingCycle: 'annually'
        },
        quotas: [
          { label: 'quota.mcpUsage', used: 12, total: 50, usageRate: 24, resetAt: new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).toISOString(), limitType: 'mcp' },
          { label: 'quota.tokensLimit', labelParams: { n: 5 }, used: 250000, total: 1000000, usageRate: 25, resetAt: new Date(now + 5 * HOUR).toISOString(), limitType: 'tokens' },
          { label: 'quota.tokensLimitDaily', labelParams: { n: 7 }, used: 6000, total: 15000, usageRate: 40, resetAt: new Date(now + 7 * DAY).toISOString(), limitType: 'tokens' }
        ],
        history1d: generateHourlyHistory(24),
        history7d: generateHourlyHistory(168),
        history30d: generateDailyHistory(30),
        totalTokens1d,
        totalTokens7d,
        totalTokens30d,
        estimatedCost1d: calcMockEstimatedCost(totalTokens1d),
        estimatedCost7d: calcMockEstimatedCost(totalTokens7d),
        estimatedCost30d: calcMockEstimatedCost(totalTokens30d),
        modelRates: calcMockModelRates(),
        mcpHistory1d: generateHourlyMcpHistory(24),
        mcpHistory7d: generateHourlyMcpHistory(168),
        mcpHistory30d: generateDailyMcpHistory(30),
        modelHistory1d: generateHourlyModelHistory(24),
        modelHistory7d: generateHourlyModelHistory(168),
        modelHistory30d: generateDailyModelHistory(30),
        performanceHistory7d: generatePerformanceHistory(7),
        performanceHistory15d: generatePerformanceHistory(15),
        performanceHistory30d: generatePerformanceHistory(30)
      }
    }
  };
}
