/**
 * Background Script
 * 用于处理反馈、上报等功能
 */

import { aesEncrypt } from "../utils/crypto";

console.log("[推文过滤器] Background Script 已启动");

// 监听插件安装/更新事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("[推文过滤器] 插件首次安装");
  } else if (details.reason === "update") {
    console.log("[推文过滤器] 插件已更新");
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
        "Content-Type": "text/plain",
      },
      body: encryptedData,
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
        'Content-Type': 'text/plain',
      },
      body: encryptedData,
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
    // content script 会自己重新加载 WASM
    sendResponse({ success: true });
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
