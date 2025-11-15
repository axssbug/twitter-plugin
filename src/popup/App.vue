<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { useFilterStore } from '../stores/filterStore'

const filterStore = useFilterStore()

const state = reactive({
  isRefreshing: false,
  errorMessage: '',
})

// 格式化时间
function formatTime(timestamp: number | null): string {
  if (!timestamp) return '从未更新'

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} 小时前`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前`
}

// 手动刷新数据
async function handleRefresh() {
  state.isRefreshing = true
  state.errorMessage = ''

  try {
    await filterStore.fetchAccounts()
  } catch (error) {
    state.errorMessage = error instanceof Error ? error.message : '刷新失败'
  } finally {
    state.isRefreshing = false
  }
}

// 初始化
onMounted(async () => {
  await filterStore.initialize()
})
</script>

<template>
  <div class="w-80 p-4 bg-white">
    <div class="mb-4">
      <h1 class="text-xl font-bold text-gray-800 mb-1">6551Yap账号过滤器</h1>
      <p class="text-sm text-gray-500">自动隐藏指定账号的推文</p>
    </div>

    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">启用过滤</span>
        <input
          type="checkbox"
          v-model="filterStore.state.isEnabled"
          @change="filterStore.saveToStorage"
          class="w-4 h-4 cursor-pointer"
        />
      </div>

      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">过滤账号数量</span>
        <span class="text-lg font-bold text-blue-600">{{ filterStore.state.accounts.length }}</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700">最后更新</span>
        <span class="text-sm text-gray-500">{{ formatTime(filterStore.state.lastUpdateTime) }}</span>
      </div>
    </div>

    <div v-if="state.errorMessage" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-600">{{ state.errorMessage }}</p>
    </div>

    <div class="mb-4">
      <button
        @click="handleRefresh"
        :disabled="state.isRefreshing || filterStore.state.isLoading"
        class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="state.isRefreshing || filterStore.state.isLoading">正在刷新...</span>
        <span v-else>手动刷新</span>
      </button>
    </div>
  </div>
</template>

