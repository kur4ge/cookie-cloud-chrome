import domainStateManager from './service/domainState';
import ConfigManager from './service/config';
import syncService from './service/syncService';
import ReportHistory from './service/reportHistory'; // 导入单例实例

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
  console.log('收到消息:', message, '来自:', sender);
  
  // 验证消息来源是否为同一扩展
  if (!sender.id || sender.id !== chrome.runtime.id) {
    console.warn('拒绝来自其他扩展或页面的消息:', sender);
    sendResponse({ success: false, message: '消息来源不合法' });
    return true;
  }
  
  // 检查消息类型
  if (message.type === 'FORCE_SYNC') {
      // 执行强制同步
      syncService.syncDomainData(false) // 同步所有数据，不仅是上次提取后的
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse({ success: false, message: '同步过程中发生错误' });
        });
      return true; // 保持消息通道开放，等待异步响应
  } 
  // 处理正常同步请求
  else if (message.type === 'NORMAL_SYNC') {
      // 执行正常同步，只同步上次提取后更新的数据
      syncService.syncDomainData(true)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          console.error('正常同步失败:', error);
          sendResponse({ success: false, message: '同步过程中发生错误' });
        });
      return true; // 保持消息通道开放，等待异步响应
  }
  // 处理查询上报记录的请求
  else if (message.type === 'QUERY_REPORTS') {
    const { options } = message;
    
    // 直接使用导入的单例实例
    ReportHistory.queryReports(options)
      .then(reports => {
        sendResponse({ success: true, data: reports });
      })
      .catch(error => {
        sendResponse({ success: false, message: '查询上报记录失败' });
      });
    
    return true; // 保持消息通道开放，等待异步响应
  }
  // 处理获取上报记录总数的请求
  else if (message.type === 'GET_REPORT_COUNT') {
    // 检查是否有筛选条件
    const { options } = message;
    
    if (options) {
      // 如果有筛选条件，使用筛选后的总数
      ReportHistory.getFilteredReportCount(options)
        .then(count => {
          sendResponse({ success: true, count });
        })
        .catch(error => {
          sendResponse({ success: false, message: '获取筛选记录总数失败' });
        });
    } else {
      // 没有筛选条件，使用原来的方法获取总数
      ReportHistory.getReportCount()
        .then(count => {
          sendResponse({ success: true, count });
        })
        .catch(error => {
          sendResponse({ success: false, message: '获取上报记录总数失败' });
        });
    }
    
    return true; // 保持消息通道开放，等待异步响应
  }
  // 处理清除所有上报记录的请求
  else if (message.type === 'CLEAR_REPORTS') {
    ReportHistory.clearAllReports()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, message: '清除所有上报记录失败' });
      });
    
    return true; // 保持消息通道开放，等待异步响应
  }
  // 处理获取所有对端公钥的请求
  else if (message.type === 'GET_ALL_PEER_KEYS') {
    ReportHistory.getAllPeerKeys()
      .then(keys => {
        sendResponse({ success: true, keys });
      })
      .catch(error => {
        sendResponse({ success: false, message: '获取所有对端公钥失败' });
      });
    
    return true; // 保持消息通道开放，等待异步响应
  }
  
  // 默认响应
  sendResponse({ error: '未知的消息类型' });
  return true;
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
        const result = await syncService.syncDomainData(true);
        console.log('自动同步完成:', result);
        
      } 
    }
  } catch (error) {
    console.error('自动同步过程中发生错误:', error);
  }
}, 10 * 1000); // 每分钟检查一次

console.log('Cookie Cloud Service Worker 已启动');
export { };
