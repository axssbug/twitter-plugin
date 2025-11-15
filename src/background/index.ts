/**
 * Background Script
 * 用于初始化数据和定时更新
 */

import { fetchFilterAccountsWithRetry, fetchFilterKeywordsWithRetry } from "../services/ossService";
import { aesEncrypt } from "../utils/crypto";

console.log("[推文过滤器] Background Script 已启动");

/**
 * 从 OSS 获取并保存过滤账号列表
 */
async function updateFilterAccounts() {
  try {
    console.log("[推文过滤器] 开始更新过滤账号列表...");

    const accounts = await fetchFilterAccountsWithRetry();

    // 保存到 Chrome Storage
    await chrome.storage.local.set({
      filterAccounts: accounts,
      lastUpdateTime: Date.now(),
    });

    console.log(`[推文过滤器] 更新成功，共 ${accounts.length} 个过滤账号`);
  } catch (error) {
    console.error("[推文过滤器] 更新失败:", error);
  }
}

/**
 * 从 OSS 获取并保存关键词列表
 */
async function updateFilterKeywords() {
  try {
    console.log("[推文过滤器] 开始更新关键词列表...");

    const keywords = await fetchFilterKeywordsWithRetry();

    // 获取现有的手动添加关键词
    const result = await chrome.storage.local.get(['filterKeywords']);
    const existingKeywords = Array.isArray(result.filterKeywords)
      ? result.filterKeywords
      : [];

    // 合并服务器关键词和手动关键词（去重）
    const mergedKeywords = Array.from(new Set([...keywords, ...existingKeywords]));

    // 保存到 Chrome Storage
    await chrome.storage.local.set({
      filterKeywords: mergedKeywords,
      serverKeywords: keywords, // 单独保存服务器关键词用于区分
    });

    console.log(`[推文过滤器] 关键词更新成功，共 ${mergedKeywords.length} 个关键词`);
  } catch (error) {
    console.error("[推文过滤器] 关键词更新失败:", error);
  }
}

/**
 * 检查是否需要更新（超过1小时未更新）
 */
async function shouldUpdate(): Promise<boolean> {
  const result = await chrome.storage.local.get(["lastUpdateTime"]);

  if (!result.lastUpdateTime) return true;

  const oneHour = 60 * 60 * 1000;
  return Date.now() - result.lastUpdateTime > oneHour;
}

/**
 * 初始化
 */
async function initialize() {
  console.log("[推文过滤器] 正在初始化 Background Script...");

  // 检查是否需要更新
  if (await shouldUpdate()) {
    await Promise.all([
      updateFilterAccounts(),
      updateFilterKeywords()
    ]);
  } else {
    console.log("[推文过滤器] 数据仍然有效，跳过更新");
  }

  // 设置定时更新（每小时检查一次）
  chrome.alarms.create("updateFilterAccounts", {
    periodInMinutes: 60,
  });

  console.log("[推文过滤器] Background Script 初始化完成");
}

// 监听定时器
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "updateFilterAccounts") {
    console.log("[推文过滤器] 定时更新触发");
    await Promise.all([
      updateFilterAccounts(),
      updateFilterKeywords()
    ]);
  }
});

// 监听插件安装/更新事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("[推文过滤器] 插件首次安装");
    await Promise.all([
      updateFilterAccounts(),
      updateFilterKeywords()
    ]);
  } else if (details.reason === "update") {
    console.log("[推文过滤器] 插件已更新");
    if (await shouldUpdate()) {
      await Promise.all([
        updateFilterAccounts(),
        updateFilterKeywords()
      ]);
    }
  }
});

/**
 * 发送误报反馈
 */
async function sendFeedback(twAccount: string, feedbackUser: string) {
  try {
    // 加密数据
    const encryptedData = await aesEncrypt({
      twAccount,
      feedbackUser,
    });

    const response = await fetch("https://ai.6551.io/api/plugin/yap/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: encryptedData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态: ${response.status}`);
    }

    const data = await response.json();
    console.log("[推文过滤器] 反馈成功:", data);

    // 保存到手动不屏蔽列表
    await addManualWhitelistAccount(twAccount);

    return { success: true, data };
  } catch (error) {
    console.error("[推文过滤器] 反馈失败:", error);
    throw error;
  }
}

/**
 * 发送手动上报
 */
async function sendManualReport(twAccount: string, url: string, feedbackUser: string) {
  try {
    // 加密数据
    const encryptedData = await aesEncrypt({
      twAccount,
      feedbackUser,
      url,
    });

    const response = await fetch('https://ai.6551.io/api/plugin/yap/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: encryptedData,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态: ${response.status}`)
    }

    const data = await response.json()
    console.log('[推文过滤器] 手动上报成功:', data)

    // 保存到本地存储
    await addManualBlockedAccount(twAccount);

    return { success: true, data };
  } catch (error) {
    console.error("[推文过滤器] 手动上报失败:", error);
    throw error;
  }
}

/**
 * 添加手动上报的账号到本地存储
 */
async function addManualBlockedAccount(twAccount: string) {
  try {
    const result = await chrome.storage.local.get(['manualBlockedAccounts', 'manualWhitelistAccounts'])
    const manualBlocked = result.manualBlockedAccounts || []
    const whitelist = result.manualWhitelistAccounts || []

    // 添加到黑名单
    if (!manualBlocked.includes(twAccount)) {
      manualBlocked.push(twAccount)
      await chrome.storage.local.set({ manualBlockedAccounts: manualBlocked })
      console.log(`[推文过滤器] 已添加手动上报账号: ${twAccount}`)
    }

    // 从白名单中移除(如果存在)
    if (whitelist.includes(twAccount)) {
      const newWhitelist = whitelist.filter((acc: string) => acc !== twAccount)
      await chrome.storage.local.set({ manualWhitelistAccounts: newWhitelist })
      console.log(`[推文过滤器] 已从手动不屏蔽列表移除: ${twAccount}`)
    }
  } catch (error) {
    console.error('[推文过滤器] 保存手动上报账号失败:', error)
  }
}

/**
 * 添加手动不屏蔽的账号到本地存储(白名单)
 */
async function addManualWhitelistAccount(twAccount: string) {
  try {
    const result = await chrome.storage.local.get(["manualWhitelistAccounts", "manualBlockedAccounts"]);
    const whitelist = result.manualWhitelistAccounts || [];
    const blacklist = result.manualBlockedAccounts || [];

    // 添加到白名单
    if (!whitelist.includes(twAccount)) {
      whitelist.push(twAccount);
      await chrome.storage.local.set({ manualWhitelistAccounts: whitelist });
      console.log(`[推文过滤器] 已添加手动不屏蔽账号: ${twAccount}`);
    }

    // 从黑名单中移除(如果存在)
    if (blacklist.includes(twAccount)) {
      const newBlacklist = blacklist.filter((acc: string) => acc !== twAccount);
      await chrome.storage.local.set({ manualBlockedAccounts: newBlacklist });
      console.log(`[推文过滤器] 已从手动上报列表移除: ${twAccount}`);
    }
  } catch (error) {
    console.error("[推文过滤器] 保存手动不屏蔽账号失败:", error);
  }
}

// 监听来自 content script 和 dashboard 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FEEDBACK_MISREPORT") {
    const { twAccount, feedbackUser } = message.data;

    sendFeedback(twAccount, feedbackUser)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }

  if (message.type === "MANUAL_REPORT") {
    const { twAccount, url, feedbackUser } = message.data;

    sendManualReport(twAccount, url, feedbackUser)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }

  if (message.type === "MANUAL_UPDATE") {
    console.log('[推文过滤器] 收到手动刷新请求');
    Promise.all([
      updateFilterAccounts(),
      updateFilterKeywords()
    ])
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示异步响应
    return true;
  }
});

// 监听插件图标点击事件
chrome.action.onClicked.addListener(() => {
  // 打开完整页面
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/pages/dashboard/index.html')
  })
})

// 启动
initialize();
