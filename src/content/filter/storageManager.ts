/**
 * 存储管理类
 * 负责加载和监听过滤账号列表和关键词列表
 */
export class StorageManager {
  // 过滤账号列表
  public filterAccounts: string[] = []
  // 手动上报的账号列表
  public manualBlockedAccounts: string[] = []
  // 手动不屏蔽的账号列表(白名单)
  public manualWhitelistAccounts: string[] = []
  // 过滤关键词列表
  public filterKeywords: string[] = []
  // 手动上报的关键词列表
  public manualBlockedKeywords: string[] = []
  // 关键词白名单
  public manualWhitelistKeywords: string[] = []
  // 是否启用过滤
  public isFilterEnabled = true

  // 存储变化回调
  private onStorageChangeCallback?: () => void

  /**
   * 加载过滤账号列表
   */
  async loadFilterAccounts(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        'filterAccounts',
        'isEnabled',
        'manualBlockedAccounts',
        'manualWhitelistAccounts',
        'filterKeywords',
        'manualBlockedKeywords',
        'manualWhitelistKeywords'
      ])

      if (result.filterAccounts) {
        this.filterAccounts = Array.isArray(result.filterAccounts)
          ? result.filterAccounts
          : Object.values(result.filterAccounts)
        console.log(`[推文过滤器] 已加载 ${this.filterAccounts.length} 个过滤账号`)
      } else {
        console.log('[推文过滤器] 未找到缓存的过滤账号')
      }

      if (result.manualBlockedAccounts) {
        this.manualBlockedAccounts = Array.isArray(result.manualBlockedAccounts)
          ? result.manualBlockedAccounts
          : Object.values(result.manualBlockedAccounts)
        console.log(`[推文过滤器] 已加载 ${this.manualBlockedAccounts.length} 个手动上报账号`)
      }

      if (result.manualWhitelistAccounts) {
        this.manualWhitelistAccounts = Array.isArray(result.manualWhitelistAccounts)
          ? result.manualWhitelistAccounts
          : Object.values(result.manualWhitelistAccounts)
        console.log(`[推文过滤器] 已加载 ${this.manualWhitelistAccounts.length} 个手动不屏蔽账号`)
      }

      if (result.filterKeywords) {
        this.filterKeywords = Array.isArray(result.filterKeywords)
          ? result.filterKeywords
          : Object.values(result.filterKeywords)
        console.log(`[推文过滤器] 已加载 ${this.filterKeywords.length} 个过滤关键词`)
      }

      if (result.manualBlockedKeywords) {
        this.manualBlockedKeywords = Array.isArray(result.manualBlockedKeywords)
          ? result.manualBlockedKeywords
          : Object.values(result.manualBlockedKeywords)
        console.log(`[推文过滤器] 已加载 ${this.manualBlockedKeywords.length} 个手动过滤关键词`)
      }

      if (result.manualWhitelistKeywords) {
        this.manualWhitelistKeywords = Array.isArray(result.manualWhitelistKeywords)
          ? result.manualWhitelistKeywords
          : Object.values(result.manualWhitelistKeywords)
        console.log(`[推文过滤器] 已加载 ${this.manualWhitelistKeywords.length} 个关键词白名单`)
      }

      this.isFilterEnabled = result.isEnabled !== undefined ? result.isEnabled : true
    } catch (error) {
      console.error('[推文过滤器] 加载过滤账号失败:', error)
    }
  }

  /**
   * 监听存储变化
   */
  setupStorageListener(callback: () => void): void {
    this.onStorageChangeCallback = callback

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        let hasChanges = false

        if (changes.filterAccounts) {
          const newValue = changes.filterAccounts.newValue || []
          this.filterAccounts = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 过滤列表已更新，共 ${this.filterAccounts.length} 个账号`)
          hasChanges = true
        }

        if (changes.manualBlockedAccounts) {
          const newValue = changes.manualBlockedAccounts.newValue || []
          this.manualBlockedAccounts = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 手动上报列表已更新，共 ${this.manualBlockedAccounts.length} 个账号`)
          hasChanges = true
        }

        if (changes.manualWhitelistAccounts) {
          const newValue = changes.manualWhitelistAccounts.newValue || []
          this.manualWhitelistAccounts = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 手动不屏蔽列表已更新，共 ${this.manualWhitelistAccounts.length} 个账号`)
          hasChanges = true
        }

        if (changes.filterKeywords) {
          const newValue = changes.filterKeywords.newValue || []
          this.filterKeywords = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 关键词列表已更新，共 ${this.filterKeywords.length} 个关键词`)
          hasChanges = true
        }

        if (changes.manualBlockedKeywords) {
          const newValue = changes.manualBlockedKeywords.newValue || []
          this.manualBlockedKeywords = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 手动过滤关键词已更新，共 ${this.manualBlockedKeywords.length} 个关键词`)
          hasChanges = true
        }

        if (changes.manualWhitelistKeywords) {
          const newValue = changes.manualWhitelistKeywords.newValue || []
          this.manualWhitelistKeywords = Array.isArray(newValue) ? newValue : Object.values(newValue)
          console.log(`[推文过滤器] 关键词白名单已更新，共 ${this.manualWhitelistKeywords.length} 个关键词`)
          hasChanges = true
        }

        if (changes.isEnabled) {
          this.isFilterEnabled = changes.isEnabled.newValue
          console.log(`[推文过滤器] 过滤状态已更新: ${this.isFilterEnabled ? '启用' : '禁用'}`)
          hasChanges = true
        }

        if (hasChanges && this.onStorageChangeCallback) {
          this.onStorageChangeCallback()
        }
      }
    })
  }

  /**
   * 检查账号是否应该被过滤
   */
  shouldFilterAccount(username: string): boolean {
    // 检查是否在白名单中(优先级最高)
    const isWhitelisted = this.manualWhitelistAccounts.includes(username) ||
                         this.manualWhitelistAccounts.includes('@' + username)
    if (isWhitelisted) {
      return false
    }

    // 检查是否在过滤列表中或手动上报列表中
    return this.filterAccounts.includes(username) ||
           this.filterAccounts.includes('@' + username) ||
           this.manualBlockedAccounts.includes(username) ||
           this.manualBlockedAccounts.includes('@' + username)
  }

  /**
   * 更新过滤启用状态
   */
  async updateFilterEnabled(enabled: boolean): Promise<void> {
    this.isFilterEnabled = enabled
    await chrome.storage.local.set({ isEnabled: enabled })
  }
}
