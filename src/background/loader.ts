import type { Provider, ProviderConfig, ProviderTypeConfig } from '../shared/types';
import { ZhipuProvider } from '../providers/zhipu';
import buildConfig from '../../app.build';

const PROVIDER_CLASSES = {
  zhipu: ZhipuProvider,
} as const;

export type ProviderType = keyof typeof PROVIDER_CLASSES;

export interface LoadedProvider {
  type: ProviderType;
  accountId: string;
  instance: Provider;
  config: ProviderConfig;
}

export function getAvailableProviderKeys(): string[] {
  return buildConfig.providers
    .filter(p => p.available)
    .map(p => p.key);
}

export class ProviderLoader {
  static loadProviders(providerConfigs: Record<string, ProviderTypeConfig>): LoadedProvider[] {
    const availableKeys = new Set(getAvailableProviderKeys());
    const loaded: LoadedProvider[] = [];

    for (const [type, providerConfig] of Object.entries(providerConfigs)) {
      if (!availableKeys.has(type)) continue;

      const ProviderClass = PROVIDER_CLASSES[type as ProviderType];
      if (!ProviderClass) {
        console.warn(`[Loader] Unknown provider type: ${type}`);
        continue;
      }

      const buildEntry = buildConfig.providers.find(p => p.key === type);

      for (const account of providerConfig.accounts) {
        if (!account.enabled) continue;
        if (!account.apiKey?.trim()) continue;

        try {
          const instance = new ProviderClass();
          loaded.push({
            type: type as ProviderType,
            accountId: account.id,
            instance,
            config: {
              enabled: true,
              apiKey: account.apiKey,
              _baseUrl: buildEntry?.baseUrl || '',
            },
          });
          console.log(`[Loader] Loaded provider: ${instance.name} (${account.label || account.id})`);
        } catch (error) {
          console.error(`[Loader] Failed to load provider ${type}:`, error);
        }
      }
    }

    return loaded;
  }
}
