/**
 * 编译时配置
 * 定义应用支持哪些 Provider，修改后需重新编译生效。
 */
export default {
  providers: [
    { key: 'zhipu', available: true, baseUrl: 'https://api.z.ai', websiteUrl: 'https://bigmodel.cn/' },
  ],
} as const;
