import type { StorageManager } from './storageManager'

/**
 * 推文处理类
 * 负责推文的过滤、隐藏和显示
 */
export class TweetProcessor {
  // 已处理的推文集合,避免重复处理
  private processedTweets = new WeakSet<Element>()
  // 用户名到显示名称的映射
  private userDisplayNames = new Map<string, string>()
  // 存储管理器引用
  private storageManager: StorageManager

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager
  }

  /**
   * 获取用户的显示名称
   */
  getUserDisplayName(element: Element, username: string): string {
    // 先检查缓存
    if (this.userDisplayNames.has(username)) {
      return this.userDisplayNames.get(username)!
    }

    // 尝试从推文中找到显示名称
    const userLinks = element.querySelectorAll('a[href*="/"]')

    for (const link of Array.from(userLinks)) {
      const href = link.getAttribute('href')
      if (href && href.match(new RegExp(`^/${username}$`))) {
        const parent = link.closest('[data-testid="User-Name"]')
        if (parent) {
          const spans = parent.querySelectorAll('span')
          for (const span of Array.from(spans)) {
            const text = span.textContent?.trim()
            // 过滤掉无效的显示名称：空字符串、@开头、用户名本身、单个特殊字符（如·）
            if (text &&
                !text.startsWith('@') &&
                text !== username &&
                text.length > 1 &&
                text !== '·') {
              this.userDisplayNames.set(username, text)
              return text
            }
          }

          const firstSpan = parent.querySelector('span')
          if (firstSpan) {
            const displayName = firstSpan.textContent?.trim()
            if (displayName &&
                displayName !== `@${username}` &&
                displayName.length > 1 &&
                displayName !== '·') {
              this.userDisplayNames.set(username, displayName)
              return displayName
            }
          }
        }
      }
    }

    return username
  }

  /**
   * 从推文元素获取用户名
   */
  getTweetUsername(element: Element): string | null {
    const userLinks = element.querySelectorAll('a[href*="/"]')

    for (const link of Array.from(userLinks)) {
      const href = link.getAttribute('href')
      if (!href) continue

      const match = href.match(/^\/([^/]+)$/)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  /**
   * 获取推文文本内容
   */
  getTweetContent(element: Element): string {
    // 获取推文的文本内容
    const tweetTextElement = element.querySelector('[data-testid="tweetText"]')
    if (tweetTextElement) {
      return tweetTextElement.textContent || ''
    }
    return ''
  }

  /**
   * 检查推文内容是否包含过滤关键词（不区分大小写）
   */
  containsFilterKeyword(content: string): string | null {
    const contentLower = content.toLowerCase()

    // 先检查白名单关键词
    const whitelistKeywords = this.storageManager.manualWhitelistKeywords || []
    for (const keyword of whitelistKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return null // 白名单关键词优先，不过滤
      }
    }

    // 检查过滤关键词
    const keywords = this.storageManager.filterKeywords || []
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return keyword
      }
    }
    return null
  }

  /**
   * 检查推文是否应该被过滤
   * @returns 返回过滤原因: 用户名或关键词
   */
  shouldFilterTweet(element: Element): string | null {
    // 检查账号过滤
    const username = this.getTweetUsername(element)
    if (username && this.storageManager.shouldFilterAccount(username)) {
      // 保存显示名称
      this.getUserDisplayName(element, username)
      return username
    }

    // 检查关键词过滤
    const content = this.getTweetContent(element)
    const keyword = this.containsFilterKeyword(content)
    if (keyword) {
      return `关键词: ${keyword}`
    }

    return null
  }

  /**
   * 隐藏推文元素
   */
  hideTweet(element: Element, username: string): void {
    const htmlElement = element as HTMLElement
    if (htmlElement.style.display !== 'none') {
      htmlElement.style.display = 'none'
      htmlElement.setAttribute('data-filtered-user', username)
      console.log(`[推文过滤器] 已隐藏推文 - 用户: ${username}`)
    }
  }

  /**
   * 显示推文元素
   */
  showTweet(element: Element): void {
    const htmlElement = element as HTMLElement
    if (htmlElement.style.display === 'none' && htmlElement.getAttribute('data-filtered-user')) {
      htmlElement.style.display = ''
      htmlElement.removeAttribute('data-filtered-user')
    }
  }

  /**
   * 显示指定用户的所有推文
   */
  showUserTweets(username: string): void {
    const allTweets = document.querySelectorAll('article[data-testid="tweet"][data-filtered-user]')

    allTweets.forEach(tweet => {
      const filteredUser = tweet.getAttribute('data-filtered-user')
      if (filteredUser === username) {
        this.showTweet(tweet)
        console.log(`[推文过滤器] 已显示推文 - 用户: ${username}`)
      }
    })

    // 从缓存中移除
    this.userDisplayNames.delete(username)
  }

  /**
   * 处理推文元素
   */
  processTweet(element: Element, forceUpdate = false): void {
    // 如果已经处理过且不是强制更新,跳过
    if (this.processedTweets.has(element) && !forceUpdate) {
      return
    }

    const username = this.shouldFilterTweet(element)
    if (username && this.storageManager.isFilterEnabled) {
      this.hideTweet(element, username)
      this.processedTweets.add(element)
    } else if (!this.storageManager.isFilterEnabled) {
      this.showTweet(element)
    } else {
      this.processedTweets.add(element)
    }
  }

  /**
   * 扫描并处理页面上的所有推文
   */
  scanAndFilterTweets(forceUpdate = false): void {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]')

    tweets.forEach(tweet => {
      this.processTweet(tweet, forceUpdate)
    })
  }

  /**
   * 清空已处理记录
   */
  clearProcessed(): void {
    // WeakSet 没有 clear 方法，但新版本可能有
    if ('clear' in this.processedTweets) {
      (this.processedTweets as any).clear()
    }
  }

  /**
   * 获取被过滤的用户统计
   */
  getFilteredUsers(): Map<string, number> {
    const userCounts = new Map<string, number>()
    const hiddenTweets = document.querySelectorAll('article[data-testid="tweet"][data-filtered-user]')

    hiddenTweets.forEach(tweet => {
      const username = tweet.getAttribute('data-filtered-user')
      if (username) {
        userCounts.set(username, (userCounts.get(username) || 0) + 1)

        if (!this.userDisplayNames.has(username)) {
          this.getUserDisplayName(tweet, username)
        }
      }
    })

    return userCounts
  }

  /**
   * 获取用户显示名称
   */
  getUserDisplayNameFromCache(username: string): string {
    return this.userDisplayNames.get(username) || username
  }

  /**
   * 获取已过滤推文数量
   */
  getFilteredCount(): number {
    return document.querySelectorAll('article[data-testid="tweet"][data-filtered-user]').length
  }
}
