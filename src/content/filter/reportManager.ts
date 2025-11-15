/**
 * 上报管理类
 * 负责手动上报和误报反馈
 */
export class ReportManager {
  /**
   * 获取当前登录的 Twitter 用户名
   */
  getCurrentTwitterUser(): string {
    try {
      // 方法1: 从导航栏的用户链接获取
      const userLink = document.querySelector('a[href*="/"][data-testid="AppTabBar_Profile_Link"]')
      if (userLink) {
        const href = userLink.getAttribute('href')
        const match = href?.match(/^\/([^/]+)$/)
        if (match) {
          return match[1]
        }
      }

      // 方法2: 从其他位置尝试获取
      const profileLinks = document.querySelectorAll('a[href*="/"][aria-label*="Profile"]')
      for (const link of Array.from(profileLinks)) {
        const href = link.getAttribute('href')
        const match = href?.match(/^\/([^/]+)$/)
        if (match) {
          return match[1]
        }
      }
    } catch (error) {
      console.error('[推文过滤器] 获取当前用户失败:', error)
    }

    return 'anonymous'
  }

  /**
   * 处理手动上报
   */
  async handleManualReport(username: string): Promise<{ success: boolean; error?: string }> {
    const currentUrl = window.location.href
    const currentUser = this.getCurrentTwitterUser()

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'MANUAL_REPORT',
        data: {
          twAccount: username,
          url: currentUrl,
          feedbackUser: currentUser
        }
      }, (response) => {
        if (response?.success) {
          console.log(`[推文过滤器] 手动上报成功: ${username}`)
          resolve({ success: true })
        } else {
          console.error(`[推文过滤器] 手动上报失败: ${username}`, response?.error)
          resolve({ success: false, error: response?.error || '未知错误' })
        }
      })
    })
  }

  /**
   * 处理误报反馈
   */
  async handleFeedbackMisreport(username: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = this.getCurrentTwitterUser()

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'FEEDBACK_MISREPORT',
        data: {
          twAccount: username,
          feedbackUser: currentUser
        }
      }, (response) => {
        if (response?.success) {
          console.log(`[推文过滤器] 反馈成功: ${username}`)
          resolve({ success: true })
        } else {
          console.error(`[推文过滤器] 反馈失败: ${username}`, response?.error)
          resolve({ success: false, error: response?.error || '未知错误' })
        }
      })
    })
  }
}
