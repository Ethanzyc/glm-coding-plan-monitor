/**
 * 单个账户配置
 */
export interface AccountConfig {
  id: string;
  enabled: boolean;
  apiKey: string;
  label: string;
}

/**
 * Provider 类型配置（支持多账户）
 */
export interface ProviderTypeConfig {
  accounts: AccountConfig[];
}

/**
 * Provider 配置接口
 */
export interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  _baseUrl?: string;
  [key: string]: unknown;
}

/**
 * 单个额度项
 */
export interface QuotaItem {
  label: string;
  labelParams?: Record<string, string | number>;
  used: number;
  total: number;
  usageRate: number;
  resetAt: string;
  startAt?: string;
  limitType?: string;
  hideBar?: boolean;
  color?: 'green' | 'yellow' | 'red';
}

/**
 * 历史统计记录
 */
export interface UsageRecord {
  date: string;
  used: number;
}

/**
 * MCP 工具调用历史记录
 */
export interface McpUsageRecord {
  date: string;
  search: number;
  webRead: number;
  zread: number;
}

/**
 * 分模型 Token 使用历史记录
 */
export interface ModelTokenRecord {
  date: string;
  model: string;
  used: number;
}

/**
 * 模型性能历史记录
 */
export interface PerformanceRecord {
  date: string;
  liteDecodeSpeed: number;
  proMaxDecodeSpeed: number;
  liteSuccessRate: number;
  proMaxSuccessRate: number;
}

/**
 * 订阅信息
 */
export interface SubscriptionInfo {
  plan: string;
  status: string;
  currentRenewTime: string;
  nextRenewTime: string;
  autoRenew: boolean;
  actualPrice: number;
  renewPrice: number;
  billingCycle: string;
}

/**
 * 用量查询结果
 */
export interface UsageResult {
  used: number;
  total: number;
  expiresAt: string;
  badgePercent?: number;
  badgePercentWeekly?: number;
  level?: string;
  error?: string;
  details?: {
    quotas?: QuotaItem[];
    usageHistory?: UsageRecord[];
    subscription?: SubscriptionInfo;
    [key: string]: unknown;
  };
}

/**
 * Provider 插件接口
 */
export interface Provider {
  name: string;
  fetchUsage(config: ProviderConfig): Promise<UsageResult>;
}

/**
 * 角标显示模式
 */
export type BadgeMode = '5h' | 'weekly' | 'off';

/**
 * 应用配置
 */
export interface AppConfig {
  refreshInterval: number;
  providers: Record<string, ProviderTypeConfig>;
  display: {
    colorThresholds: {
      green: number;
      yellow: number;
    };
  };
  showEstimatedCost?: boolean;
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  badgeMode?: BadgeMode;
}

/**
 * 显示颜色
 */
export type DisplayColor = 'green' | 'yellow' | 'red';

/**
 * Chrome 扩展消息类型
 */
export type ChromeMessageAction =
  | 'getUsageData'
  | 'refreshUsage'
  | 'getConfig'
  | 'updateConfig'
  | 'getAvailableProviders'
  | 'openExternal';

export interface ChromeMessage {
  action: ChromeMessageAction;
  [key: string]: unknown;
}

/**
 * 渲染器使用的完整用量状态
 */
export interface UsageState {
  providers: ProviderUsageData[];
  lastUpdate: string;
  overallPercent: number;
}

export interface ProviderUsageData {
  key: string;
  name: string;
  websiteUrl: string;
  accounts: AccountUsageData[];
}

export interface AccountUsageData {
  id: string;
  label: string;
  enabled: boolean;
  used: number;
  total: number;
  usageRate: number;
  expiresAt: string;
  level?: string;
  error?: string;
  quotas: QuotaItem[];
  history1d?: UsageRecord[];
  history7d?: UsageRecord[];
  history30d?: UsageRecord[];
  totalTokens1d?: number;
  totalTokens7d?: number;
  totalTokens30d?: number;
  estimatedCost1d?: number;
  estimatedCost7d?: number;
  estimatedCost30d?: number;
  mcpHistory1d?: McpUsageRecord[];
  mcpHistory7d?: McpUsageRecord[];
  mcpHistory30d?: McpUsageRecord[];
  modelHistory1d?: ModelTokenRecord[];
  modelHistory7d?: ModelTokenRecord[];
  modelHistory30d?: ModelTokenRecord[];
  performanceHistory7d?: PerformanceRecord[];
  performanceHistory15d?: PerformanceRecord[];
  performanceHistory30d?: PerformanceRecord[];
  modelRates?: Record<string, number>;
  subscription?: SubscriptionInfo;
}

/**
 * 生成账户 ID（8 位随机 hex）
 */
export function generateAccountId(): string {
  return Math.random().toString(16).slice(2, 10);
}
