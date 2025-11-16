<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

const manualBlockedAccounts = ref<string[]>([]);
const manualWhitelistAccounts = ref<string[]>([]);
const isFilterEnabled = ref(true);
const currentTab = ref<"manual" | "whitelist">("manual");
const systemAccountCount = ref(0);

// 搜索和分页
const searchText = ref("");
const systemCurrentPage = ref(1);
const manualCurrentPage = ref(1);
const whitelistCurrentPage = ref(1);
const pageSize = ref(20);

// 过滤后的数据

const filteredManualAccounts = computed(() => {
  if (!searchText.value) return manualBlockedAccounts.value;
  return manualBlockedAccounts.value.filter((acc) => acc.toLowerCase().includes(searchText.value.toLowerCase()));
});

const filteredWhitelistAccounts = computed(() => {
  if (!searchText.value) return manualWhitelistAccounts.value;
  return manualWhitelistAccounts.value.filter((acc) => acc.toLowerCase().includes(searchText.value.toLowerCase()));
});

// 分页后的数据
const paginatedManualAccounts = computed(() => {
  const start = (manualCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredManualAccounts.value.slice(start, end);
});

const paginatedWhitelistAccounts = computed(() => {
  const start = (whitelistCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredWhitelistAccounts.value.slice(start, end);
});

/**
 * 加载数据
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get(["manualBlockedAccounts", "manualWhitelistAccounts", "isEnabled", "wasmAccountCount"]);

    manualBlockedAccounts.value = Array.isArray(result.manualBlockedAccounts)
      ? result.manualBlockedAccounts
      : Object.values(result.manualBlockedAccounts || {});

    manualWhitelistAccounts.value = Array.isArray(result.manualWhitelistAccounts)
      ? result.manualWhitelistAccounts
      : Object.values(result.manualWhitelistAccounts || {});

    isFilterEnabled.value = result.isEnabled !== undefined ? result.isEnabled : true;
    systemAccountCount.value = result.wasmAccountCount || 0;
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
 * 移除账号
 */
async function removeAccount(account: string, type: "manual" | "whitelist") {
  try {
    await ElMessageBox.confirm(`确定要移除 ${account} 吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    if (type === "manual") {
      const newList = manualBlockedAccounts.value.filter((acc) => acc !== account);
      await chrome.storage.local.set({ manualBlockedAccounts: newList });
      manualBlockedAccounts.value = newList;
    } else {
      const newList = manualWhitelistAccounts.value.filter((acc) => acc !== account);
      await chrome.storage.local.set({ manualWhitelistAccounts: newList });
      manualWhitelistAccounts.value = newList;
    }

    ElMessage.success("移除成功");
    console.log(`[推文过滤器] 已移除账号: ${account}`);
  } catch (error) {
    if (error !== "cancel") {
      console.error("[推文过滤器] 移除账号失败:", error);
      ElMessage.error("移除失败");
    }
  }
}

/**
 * 打开 X 账号页面
 */
function openXAccount(account: string) {
  const username = account.startsWith("@") ? account.slice(1) : account;
  window.open(`https://x.com/${username}`, "_blank");
}

/**
 * 监听存储变化（仅监听外部变化）
 */
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      // 在服务器数据更新或最后更新时间变化时重新加载
      if (changes.filterAccounts || changes.lastUpdateTime) {
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
      <el-input v-model="searchText" placeholder="搜索账号..." clearable class="max-w-400px" />
      <el-switch v-model="isFilterEnabled" @change="toggleFilterEnabled" active-text="已启用" inactive-text="已禁用" />
    </div>

    <!-- 智能识别提示 -->
    <div class="px-6 py-3 mb-4 bg-[#0d0d0d] border-b border-[#2a2a2a]">
      <p class="text-sm text-gray-400">
        6551智能识别 <span class="text-[#409eff] font-semibold">{{ systemAccountCount }}</span> 个账户
      </p>
    </div>

    <!-- Tabs -->
    <el-tabs type="border-card" v-model="currentTab" class="flex-1 flex flex-col overflow-hidden">
      <el-tab-pane label="手动过滤" name="manual">
        <div class="h-[calc(100vh-200px)] flex flex-col bg-[#1a1a1a]">
          <el-empty v-if="filteredManualAccounts.length === 0" description="暂无手动过滤账号" />
          <template v-else>
            <el-table :data="paginatedManualAccounts" class="flex-1">
              <el-table-column label="账号">
                <template #default="{ row }">
                  <span class="text-[#67c23a] cursor-pointer hover:text-[#85ce61]" @click="openXAccount(row)">
                    {{ row.startsWith("@") ? row : "@" + row }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="removeAccount(row, 'manual')"> 移除 </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="p-4 text-right border-t">
              <el-pagination
                v-model:current-page="manualCurrentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="filteredManualAccounts.length"
                layout="total, sizes, prev, pager, next, jumper"
                background
              />
            </div>
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane label="白名单" name="whitelist">
        <div class="h-[calc(100vh-200px)] flex flex-col bg-[#1a1a1a]">
          <el-empty v-if="filteredWhitelistAccounts.length === 0" description="暂无白名单账号" />
          <template v-else>
            <el-table :data="paginatedWhitelistAccounts" class="flex-1">
              <el-table-column label="账号">
                <template #default="{ row }">
                  <span class="text-[#67c23a] cursor-pointer hover:text-[#85ce61]" @click="openXAccount(row)">
                    {{ row.startsWith("@") ? row : "@" + row }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="removeAccount(row, 'whitelist')"> 移除 </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="p-4 text-right border-t">
              <el-pagination
                v-model:current-page="whitelistCurrentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="filteredWhitelistAccounts.length"
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
