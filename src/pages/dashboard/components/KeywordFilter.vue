<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

const manualBlockedKeywords = ref<string[]>([]);
const manualWhitelistKeywords = ref<string[]>([]);
const isFilterEnabled = ref(true);
const currentTab = ref<"manual" | "whitelist">("manual");
const keywordInput = ref("");
const whitelistInput = ref("");
const systemKeywordCount = ref(0);
const isRefreshing = ref(false);

// 搜索和分页
const searchText = ref("");
const systemCurrentPage = ref(1);
const manualCurrentPage = ref(1);
const whitelistCurrentPage = ref(1);
const pageSize = ref(20);

// 过滤后的数据

const filteredManualKeywords = computed(() => {
  if (!searchText.value) return manualBlockedKeywords.value;
  return manualBlockedKeywords.value.filter((kw) => kw.toLowerCase().includes(searchText.value.toLowerCase()));
});

const filteredWhitelistKeywords = computed(() => {
  if (!searchText.value) return manualWhitelistKeywords.value;
  return manualWhitelistKeywords.value.filter((kw) => kw.toLowerCase().includes(searchText.value.toLowerCase()));
});

// 分页后的数据
const paginatedManualKeywords = computed(() => {
  const start = (manualCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredManualKeywords.value.slice(start, end);
});

const paginatedWhitelistKeywords = computed(() => {
  const start = (whitelistCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredWhitelistKeywords.value.slice(start, end);
});

/**
 * 加载数据
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get(["manualBlockedKeywords", "manualWhitelistKeywords", "isEnabled", "wasmKeywordCount"]);

    manualBlockedKeywords.value = Array.isArray(result.manualBlockedKeywords)
      ? result.manualBlockedKeywords
      : Object.values(result.manualBlockedKeywords || {});

    manualWhitelistKeywords.value = Array.isArray(result.manualWhitelistKeywords)
      ? result.manualWhitelistKeywords
      : Object.values(result.manualWhitelistKeywords || {});

    isFilterEnabled.value = result.isEnabled !== undefined ? result.isEnabled : true;
    systemKeywordCount.value = result.wasmKeywordCount || 0;
  } catch (error) {
    console.error("[推文过滤器] 加载数据失败:", error);
  }
}

/**
 * 切换过滤启用状态
 */
async function toggleFilterEnabled(value: boolean) {
  try {
    await chrome.storage.local.set({ isEnabled: value });
    console.log(`[推文过滤器] 过滤功能已${value ? "启用" : "禁用"}`);
    ElMessage.success(`过滤功能已${value ? "启用" : "禁用"}`);
  } catch (error) {
    console.error("[推文过滤器] 更新状态失败:", error);
    ElMessage.error("更新状态失败");
  }
}

/**
 * 添加关键词
 */
async function addKeyword() {
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    ElMessage.warning("关键词不能为空");
    return;
  }

  if (manualBlockedKeywords.value.includes(keyword)) {
    ElMessage.warning("关键词已存在");
    return;
  }

  try {
    const newList = [...manualBlockedKeywords.value, keyword];

    await chrome.storage.local.set({
      manualBlockedKeywords: newList,
    });

    manualBlockedKeywords.value = newList;
    keywordInput.value = "";
    ElMessage.success("添加成功");
    console.log(`[推文过滤器] 已添加关键词: ${keyword}`);
  } catch (error) {
    console.error("[推文过滤器] 添加关键词失败:", error);
    ElMessage.error("添加失败");
  }
}

/**
 * 添加白名单关键词
 */
async function addWhitelist() {
  const keyword = whitelistInput.value.trim();
  if (!keyword) {
    ElMessage.warning("关键词不能为空");
    return;
  }

  if (manualWhitelistKeywords.value.includes(keyword)) {
    ElMessage.warning("关键词已存在");
    return;
  }

  try {
    const newList = [...manualWhitelistKeywords.value, keyword];
    await chrome.storage.local.set({ manualWhitelistKeywords: newList });
    manualWhitelistKeywords.value = newList;
    whitelistInput.value = "";
    ElMessage.success("添加成功");
    console.log(`[推文过滤器] 已添加白名单关键词: ${keyword}`);
  } catch (error) {
    console.error("[推文过滤器] 添加白名单关键词失败:", error);
    ElMessage.error("添加失败");
  }
}

/**
 * 移除关键词
 */
async function removeKeyword(keyword: string, type: "manual" | "whitelist") {
  try {
    await ElMessageBox.confirm(`确定要移除关键词 "${keyword}" 吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    if (type === "manual") {
      const newManualList = manualBlockedKeywords.value.filter((k) => k !== keyword);

      await chrome.storage.local.set({
        manualBlockedKeywords: newManualList,
      });

      manualBlockedKeywords.value = newManualList;
    } else {
      const newList = manualWhitelistKeywords.value.filter((k) => k !== keyword);
      await chrome.storage.local.set({ manualWhitelistKeywords: newList });
      manualWhitelistKeywords.value = newList;
    }

    ElMessage.success("移除成功");
    console.log(`[推文过滤器] 已移除关键词: ${keyword}`);
  } catch (error) {
    if (error !== "cancel") {
      console.error("[推文过滤器] 移除关键词失败:", error);
      ElMessage.error("移除失败");
    }
  }
}

/**
 * 手动刷新数据
 */
async function handleRefresh() {
  if (isRefreshing.value) return;

  isRefreshing.value = true;
  try {
    await chrome.runtime.sendMessage({ type: 'MANUAL_UPDATE' });
    await loadData();
    ElMessage.success('数据刷新成功');
  } catch (error) {
    console.error('[推文过滤器] 刷新失败:', error);
    ElMessage.error('刷新失败');
  } finally {
    isRefreshing.value = false;
  }
}

/**
 * 监听存储变化（仅监听外部变化）
 */
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      // 在服务器数据更新时重新加载
      if (changes.serverKeywords) {
        loadData();
      }
    }
  });
}

onMounted(() => {
  loadData();
  setupStorageListener();
});
</script>

<style></style>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-[#1a1a1a]">
    <!-- 顶部工具栏 -->
    <div class="px-6 py-4 mb-4 border-b border-[#2a2a2a] flex justify-between items-center bg-[#0d0d0d]">
      <el-input v-model="searchText" placeholder="搜索关键词..." clearable class="max-w-400px" />
      <div class="flex items-center gap-4">
        <el-switch v-model="isFilterEnabled" @change="toggleFilterEnabled" active-text="已启用" inactive-text="已禁用" />
        <el-button :loading="isRefreshing" @click="handleRefresh" size="small">刷新</el-button>
      </div>
    </div>

    <!-- 智能识别提示 -->
    <div class="px-6 py-3 mb-4 bg-[#0d0d0d] border-b border-[#2a2a2a]">
      <p class="text-sm text-gray-400">
        6551智能识别 <span class="text-[#409eff] font-semibold">{{ systemKeywordCount }}</span> 个关键词
      </p>
    </div>

    <!-- Tabs -->
    <el-tabs type="border-card" v-model="currentTab" class="flex-1 flex flex-col overflow-hidden">
      <el-tab-pane label="手动过滤" name="manual">
        <div class="h-[calc(100vh-200px)] flex flex-col bg-[#1a1a1a]">
          <!-- 添加关键词输入框 -->
          <div class="p-4 bg-[#0d0d0d] border-b border-[#2a2a2a]">
            <el-input v-model="keywordInput" placeholder="输入要过滤的关键词..." @keyup.enter="addKeyword" class="max-w-400px">
              <template #append>
                <el-button type="primary" @click="addKeyword">添加</el-button>
              </template>
            </el-input>
          </div>

          <el-empty v-if="filteredManualKeywords.length === 0" description="暂无手动过滤关键词" />
          <template v-else>
            <el-table :data="paginatedManualKeywords" class="flex-1">
              <el-table-column label="关键词">
                <template #default="{ row }">
                  <el-tag type="success" effect="dark">{{ row }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="removeKeyword(row, 'manual')"> 移除 </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="p-4 text-right border-t ">
              <el-pagination
                v-model:current-page="manualCurrentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="filteredManualKeywords.length"
                layout="total, sizes, prev, pager, next, jumper"
                background
              />
            </div>
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="白名单" name="whitelist">
        <div class="h-[calc(100vh-200px)] flex flex-col bg-[#1a1a1a]">
          <!-- 添加白名单关键词输入框 -->
          <div class="p-4 bg-[#0d0d0d] border-b border-[#2a2a2a]">
            <el-input v-model="whitelistInput" placeholder="输入要加入白名单的关键词..." @keyup.enter="addWhitelist" class="max-w-400px">
              <template #append>
                <el-button type="primary" @click="addWhitelist">添加</el-button>
              </template>
            </el-input>
          </div>

          <el-empty v-if="filteredWhitelistKeywords.length === 0" description="暂无白名单关键词" />
          <template v-else>
            <el-table :data="paginatedWhitelistKeywords" class="flex-1">
              <el-table-column label="关键词">
                <template #default="{ row }">
                  <el-tag type="info" effect="dark">{{ row }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="removeKeyword(row, 'whitelist')"> 移除 </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="p-4 text-right border-t">
              <el-pagination
                v-model:current-page="whitelistCurrentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="filteredWhitelistKeywords.length"
                layout="total, sizes, prev, pager, next, jumper"
                background
              />
            </div>
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
