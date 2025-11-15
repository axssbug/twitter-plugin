/**
 * Twitter/X 推文过滤 Content Script
 * 自动隐藏指定账号的推文和回复
 */

import { TweetFilter } from './filter/tweetFilter'

console.log('[推文过滤器] Content Script 已加载')

// 创建并启动过滤器
const tweetFilter = new TweetFilter()
tweetFilter.initialize()
