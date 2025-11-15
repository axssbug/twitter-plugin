/**
 * OSS 数据获取服务
 * 从远程 OSS 获取需要过滤的 Twitter 账号列表和关键词列表
 */

const OSS_URL = 'https://6551.tos-cn-hongkong.volces.com/yap/yap.json'
const KEYWORD_OSS_URL = 'https://6551.tos-cn-hongkong.volces.com/yap/infofi.json'

// 定义数据结构
export interface OssData {
  dataList: Array<{ twAccount: string }>
}

export interface KeywordOssData {
  dataList: Array<{ text: string }>
}

/**
 * 从 OSS 获取过滤账号列表
 * @returns 账号列表数组
 */
export async function fetchFilterAccounts(): Promise<string[]> {
  try {
    const response = await fetch(OSS_URL)

    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态: ${response.status}`)
    }

    const data: OssData = await response.json()

    // 提取 tw_account 列表
    const accounts = data.dataList.map(item => item.twAccount)

    console.log(`成功获取 ${accounts.length} 个过滤账号`)

    return accounts
  } catch (error) {
    console.error('获取 OSS 数据失败:', error)
    throw error
  }
}

/**
 * 带重试机制的获取函数
 * @param maxRetries 最大重试次数
 * @returns 账号列表数组
 */
export async function fetchFilterAccountsWithRetry(maxRetries = 3): Promise<string[]> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFilterAccounts()
    } catch (error) {
      lastError = error as Error
      console.log(`第 ${i + 1} 次尝试失败，${i < maxRetries - 1 ? '正在重试...' : '已达到最大重试次数'}`)

      // 如果不是最后一次尝试，等待一段时间后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  throw lastError || new Error('获取数据失败')
}

/**
 * 从 OSS 获取关键词列表
 * @returns 关键词列表数组
 */
export async function fetchFilterKeywords(): Promise<string[]> {
  try {
    const response = await fetch(KEYWORD_OSS_URL)

    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态: ${response.status}`)
    }

    const data: KeywordOssData = await response.json()

    // 提取关键词列表
    const keywords = data.dataList.map(item => item.text)

    console.log(`成功获取 ${keywords.length} 个过滤关键词`)

    return keywords
  } catch (error) {
    console.error('获取关键词数据失败:', error)
    throw error
  }
}

/**
 * 带重试机制的关键词获取函数
 * @param maxRetries 最大重试次数
 * @returns 关键词列表数组
 */
export async function fetchFilterKeywordsWithRetry(maxRetries = 3): Promise<string[]> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFilterKeywords()
    } catch (error) {
      lastError = error as Error
      console.log(`第 ${i + 1} 次尝试获取关键词失败，${i < maxRetries - 1 ? '正在重试...' : '已达到最大重试次数'}`)

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
  }

  throw lastError || new Error('获取关键词数据失败')
}
