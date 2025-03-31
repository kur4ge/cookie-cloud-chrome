import domainStateManager from './service/domainState';
import ConfigManager from './service/config';
import syncService from './service/syncService';
import { handleMessage } from './actions'; // 导入消息处理函数

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Cookie Cloud 扩展已安装', details);
  // 初始化操作
  if (details.reason === 'install') {
    // 首次安装时的初始化
    try {
      // 初始化基础配置
      const config = await ConfigManager.getBaseConfig();
      if (!config.privateKey) {
        // 如果没有私钥，可以在这里生成
        console.log('初始化配置...');
      }
      // 重置域名状态管理器
      domainStateManager.reset();
      
      console.log('初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
    }
  } else if (details.reason === 'update') {
    // 更新时的处理
    console.log('扩展已更新');
  }
});

// 监听来自扩展其他部分的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessage(message, sender, sendResponse);
});

// 监听 cookie 变化
chrome.cookies.onChanged.addListener((changeInfo) => {
  // 处理 cookie 变化事件
  domainStateManager.handleCookieChange(changeInfo);
});

// 监听请求头信息
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    // 处理请求头信息
    domainStateManager.handleRequestHeaders(details);
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    domainStateManager.clearTabDomains(tabId);
  }
});

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
  domainStateManager.clearTabDomains(tabId);
});

// 设置定期清理过期数据的任务
setInterval(() => {
  domainStateManager.cleanupExpiredData();
}, 6 * 60 * 60 * 1000); // 每6小时清理一次

// 设置自动同步任务
setInterval(async () => {
  try {
    // 获取配置，检查是否启用了自动同步
    const config = await ConfigManager.getBaseConfig();
    if (config.enableAutoSync) {
      // 获取上次同步时间和当前时间
      const now = Date.now();
      const lastSyncTime = config.lastSyncTime || 0;
      const syncIntervalMs = config.syncInterval * 60 * 1000; // 转换为毫秒
      
      // 判断是否达到同步间隔
      if (now - lastSyncTime >= syncIntervalMs) {
        // 执行同步，只同步变化的数据
        await syncService.syncDomainData(true);
      } 
    }
  } catch (error) {
    console.error('自动同步过程中发生错误:', error);
  }
}, 10 * 1000); // 每分钟检查一次

console.log('Cookie Cloud Service Worker 已启动');
syncService.syncDomainData(false) // 同步所有数据，不仅是上次提取后的
.then(_ => {
  console.info('初始化同步成功');
})
.catch(error => {
  console.error('初始化同步失败:', error);
});

export { };
