/**
 * HTTP 响应
 */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * HTTP 请求选项
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * 基于 fetch 的 HTTP 客户端
 */
export class HttpClient {
  static async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 10000);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body || undefined,
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });

      return { status: response.status, headers, body };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(url, { method: 'GET', headers });
  }

  static async post(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request(url, {
      method: 'POST',
      body,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  static async getJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.get(url, headers);
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.body}`);
    }
    try {
      return JSON.parse(response.body) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }
}

/**
 * 带重试的 HTTP 客户端
 */
export class HttpClientWithRetry {
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await HttpClient.get(url, headers);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          console.warn(`[HttpClient] Retry ${attempt + 1}/${this.maxRetries} for ${url}`);
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  async getJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.get(url, headers);
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.body}`);
    }
    try {
      return JSON.parse(response.body) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }
}
