<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

const manualBlockedUsernames = ref<string[]>([]);
const manualWhitelistUsernames = ref<string[]>([]);
const isFilterEnabled = ref(true);
const currentTab = ref<"manual" | "whitelist">("manual");
const usernameInput = ref("");
const whitelistInput = ref("");
const systemUsernameCount = ref(0);
const isRefreshing = ref(false);

// 搜索和分页
const searchText = ref("");
const systemCurrentPage = ref(1);
const manualCurrentPage = ref(1);
const whitelistCurrentPage = ref(1);
const pageSize = ref(20);

// 过滤后的数据

const filteredManualUsernames = computed(() => {
  if (!searchText.value) return manualBlockedUsernames.value;
  return manualBlockedUsernames.value.filter((name) => name.toLowerCase().includes(searchText.value.toLowerCase()));
});

const filteredWhitelistUsernames = computed(() => {
  if (!searchText.value) return manualWhitelistUsernames.value;
  return manualWhitelistUsernames.value.filter((name) => name.toLowerCase().includes(searchText.value.toLowerCase()));
});

// 分页后的数据
const paginatedManualUsernames = computed(() => {
  const start = (manualCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredManualUsernames.value.slice(start, end);
});

const paginatedWhitelistUsernames = computed(() => {
  const start = (whitelistCurrentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredWhitelistUsernames.value.slice(start, end);
});

/**
 * 加载数据
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get(["manualBlockedUsernames", "manualWhitelistUsernames", "isEnabled"]);

    manualBlockedUsernames.value = Array.isArray(result.manualBlockedUsernames)
      ? result.manualBlockedUsernames
      : Object.values(result.manualBlockedUsernames || {});

    manualWhitelistUsernames.value = Array.isArray(result.manualWhitelistUsernames)
      ? result.manualWhitelistUsernames
      : Object.values(result.manualWhitelistUsernames || {});

    isFilterEnabled.value = result.isEnabled !== undefined ? result.isEnabled : true;
    // 用户名过滤目前没有系统识别，显示0
    systemUsernameCount.value = 0;
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
 * 添加用户名
 */
async function addUsername() {
  const username = usernameInput.value.trim();
  if (!username) {
    ElMessage.warning("用户名不能为空");
    return;
  }

  if (manualBlockedUsernames.value.includes(username)) {
    ElMessage.warning("用户名已存在");
    return;
  }

  try {
    const newList = [...manualBlockedUsernames.value, username];

    await chrome.storage.local.set({
      manualBlockedUsernames: newList,
    });

    manualBlockedUsernames.value = newList;
    usernameInput.value = "";
    ElMessage.success("添加成功");
    console.log(`[推文过滤器] 已添加用户名: ${username}`);
  } catch (error) {
    console.error("[推文过滤器] 添加用户名失败:", error);
    ElMessage.error("添加失败");
  }
}

/**
 * 添加白名单用户名
 */
async function addWhitelist() {
  const username = whitelistInput.value.trim();
  if (!username) {
    ElMessage.warning("用户名不能为空");
    return;
  }

  if (manualWhitelistUsernames.value.includes(username)) {
    ElMessage.warning("用户名已存在");
    return;
  }

  try {
    const newList = [...manualWhitelistUsernames.value, username];
    await chrome.storage.local.set({ manualWhitelistUsernames: newList });
    manualWhitelistUsernames.value = newList;
    whitelistInput.value = "";
    ElMessage.success("添加成功");
    console.log(`[推文过滤器] 已添加白名单用户名: ${username}`);
  } catch (error) {
    console.error("[推文过滤器] 添加白名单用户名失败:", error);
    ElMessage.error("添加失败");
  }
}

/**
 * 移除用户名
 */
async function removeUsername(username: string, type: "manual" | "whitelist") {
  try {
    await ElMessageBox.confirm(`确定要移除用户名 "${username}" 吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    if (type === "manual") {
      const newManualList = manualBlockedUsernames.value.filter((n) => n !== username);

      await chrome.storage.local.set({
        manualBlockedUsernames: newManualList,
      });

      manualBlockedUsernames.value = newManualList;
    } else {
      const newList = manualWhitelistUsernames.value.filter((n) => n !== username);
      await chrome.storage.local.set({ manualWhitelistUsernames: newList });
      manualWhitelistUsernames.value = newList;
    }

    ElMessage.success("移除成功");
    console.log(`[推文过滤器] 已移除用户名: ${username}`);
  } catch (error) {
    if (error !== "cancel") {
      console.error("[推文过滤器] 移除用户名失败:", error);
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
      if (changes.serverUsernames) {
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
      <el-input v-model="searchText" placeholder="搜索用户名..." clearable class="max-w-400px" />
      <div class="flex items-center gap-4">
        <el-switch v-model="isFilterEnabled" @change="toggleFilterEnabled" active-text="已启用" inactive-text="已禁用" />
        <el-button :loading="isRefreshing" @click="handleRefresh" size="small">刷新</el-button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 flex flex-col bg-[#1a1a1a] p-4">
      <!-- 添加用户名输入框 -->
      <div class="p-4 bg-[#0d0d0d] border-b border-[#2a2a2a] mb-4">
        <el-input v-model="usernameInput" placeholder="输入要过滤的用户名..." @keyup.enter="addUsername" class="max-w-400px">
          <template #append>
            <el-button type="primary" @click="addUsername">添加</el-button>
          </template>
        </el-input>
      </div>

      <el-empty v-if="filteredManualUsernames.length === 0" description="暂无手动过滤用户名" />
      <template v-else>
        <el-table :data="paginatedManualUsernames" class="flex-1">
          <el-table-column label="用户名">
            <template #default="{ row }">
              <el-tag type="warning" effect="dark">{{ row }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="removeUsername(row, 'manual')"> 移除 </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="p-4 text-right border-t ">
          <el-pagination
            v-model:current-page="manualCurrentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="filteredManualUsernames.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
          />
        </div>
      </template>
    </div>
  </div>
</template>
