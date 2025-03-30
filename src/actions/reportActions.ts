import ReportHistory from '../service/reportHistory';

/**
 * 处理报告相关的消息
 * @param message 消息对象
 * @param sender 发送者信息
 * @param sendResponse 响应回调
 * @returns 是否保持消息通道开放
 */
export function handleReportActions(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): boolean {
  if (message.type === 'QUERY_REPORTS') {
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
  
  return false;
}