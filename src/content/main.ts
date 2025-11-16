/**
 * Twitter/X 推文过滤 Content Script
 * 自动隐藏指定账号的推文和回复
 */

import { TweetFilter } from './filter/tweetFilter'
import { initializeWasmWithRetry, getAccountCount, getWordCount } from '../services/wasmService'

console.log('[推文过滤器] Content Script 已加载')

// 初始化WASM模块并启动过滤器
async function initialize() {
  try {
    // 先加载WASM模块
    console.log('[推文过滤器] 正在加载WASM模块...')
    await initializeWasmWithRetry()
    console.log('[推文过滤器] WASM模块加载完成')

    // 保存WASM计数到storage
    const accountCount = getAccountCount()
    const keywordCount = getWordCount()
    await chrome.storage.local.set({
      wasmAccountCount: accountCount,
      wasmKeywordCount: keywordCount,
      lastWasmLoadTime: Date.now()
    })
    console.log(`[推文过滤器] WASM统计 - 账号: ${accountCount}, 关键词: ${keywordCount}`)

    // 创建并启动过滤器
    const tweetFilter = new TweetFilter()
    await tweetFilter.initialize()
  } catch (error) {
    console.error('[推文过滤器] 初始化失败:', error)
    // 即使WASM加载失败，也继续运行过滤器（使用手动列表）
    const tweetFilter = new TweetFilter()
    await tweetFilter.initialize()
  }
}

initialize()
