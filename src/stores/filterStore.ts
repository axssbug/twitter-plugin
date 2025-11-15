import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { fetchFilterAccountsWithRetry } from '../services/ossService'

/**
 * 过滤账号数据存储
 * 使用 Pinia 管理过滤账号列表的状态
 */
export const useFilterStore = defineStore('filter', () => {
  // 使用 reactive 定义状态
  const state = reactive({
    accounts: [] as string[], // 需要过滤的账号列表
    isLoading: false, // 是否正在加载
    lastUpdateTime: null as number | null, // 最后更新时间戳
    error: null as string | null, // 错误信息
    isEnabled: true, // 是否启用过滤功能
  })

  /**
   * 从 Chrome Storage 加载缓存的账号列表
   */
  async function loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(['filterAccounts', 'lastUpdateTime', 'isEnabled'])

      if (result.filterAccounts) {
        // 确保 filterAccounts 是数组格式
        state.accounts = Array.isArray(result.filterAccounts)
          ? result.filterAccounts
          : Object.values(result.filterAccounts)
        state.lastUpdateTime = result.lastUpdateTime || null
        state.isEnabled = result.isEnabled !== undefined ? result.isEnabled : true
        console.log(`从缓存加载了 ${state.accounts.length} 个过滤账号`)
      }
    } catch (error) {
      console.error('从存储加载数据失败:', error)
    }
  }

  /**
   * 保存账号列表到 Chrome Storage
   */
  async function saveToStorage() {
    try {
      // 确保保存的是数组格式
      const accountsArray = Array.isArray(state.accounts)
        ? state.accounts
        : Object.values(state.accounts)

      await chrome.storage.local.set({
        filterAccounts: accountsArray,
        lastUpdateTime: state.lastUpdateTime,
        isEnabled: state.isEnabled,
      })
      console.log('账号列表已保存到缓存')
    } catch (error) {
      console.error('保存到存储失败:', error)
    }
  }

  /**
   * 从 OSS 获取最新的账号列表
   */
  async function fetchAccounts() {
    state.isLoading = true
    state.error = null

    try {
      const accounts = await fetchFilterAccountsWithRetry()
      state.accounts = accounts
      state.lastUpdateTime = Date.now()

      // 保存到 Chrome Storage
      await saveToStorage()

      console.log('账号列表更新成功')
    } catch (error) {
      state.error = error instanceof Error ? error.message : '获取数据失败'
      console.error('更新账号列表失败:', error)
      throw error
    } finally {
      state.isLoading = false
    }
  }

  /**
   * 检查是否需要更新（超过1小时未更新）
   */
  function shouldUpdate(): boolean {
    if (!state.lastUpdateTime) return true

    const oneHour = 60 * 60 * 1000
    return Date.now() - state.lastUpdateTime > oneHour
  }

  /**
   * 初始化：加载缓存数据，并在需要时更新
   */
  async function initialize() {
    await loadFromStorage()

    // 如果需要更新，从 OSS 获取最新数据
    if (shouldUpdate()) {
      try {
        await fetchAccounts()
      } catch (error) {
        console.error('初始化时更新数据失败:', error)
        // 即使更新失败，也继续使用缓存的数据
      }
    }
  }

  /**
   * 检查某个账号是否应该被过滤
   */
  function shouldFilterAccount(account: string): boolean {
    return state.isEnabled && state.accounts.includes(account)
  }

  /**
   * 切换启用状态
   */
  async function toggleEnabled() {
    state.isEnabled = !state.isEnabled
    await saveToStorage()
    console.log(`过滤功能已${state.isEnabled ? '启用' : '禁用'}`)
  }

  return {
    state,
    loadFromStorage,
    saveToStorage,
    fetchAccounts,
    shouldUpdate,
    initialize,
    shouldFilterAccount,
    toggleEnabled,
  }
})
