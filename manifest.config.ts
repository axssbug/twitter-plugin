import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  description: "X (Twitter) 推文内容过滤器 - 自动过滤可疑水军账号和关键词，支持手动上报、误报反馈和白名单管理",
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['https://twitter.com/*', 'https://x.com/*'],
  }],
  permissions: [
    'storage',
    'alarms',
  ],
  host_permissions: [
    'https://6551.tos-cn-hongkong.volces.com/*',
    'https://ai.6551.io/*',
  ],
})
