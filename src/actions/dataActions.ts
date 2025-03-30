import ConfigManager from '../service/config';
import ReportHistory from '../service/reportHistory';
import domainStateManager from '../service/domainState';

/**
 * 处理数据管理相关的消息
 * @param message 消息对象
 * @param sender 发送者信息
 * @param sendResponse 响应回调
 * @returns 是否保持消息通道开放
 */
export function handleDataActions(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): boolean {
  if (message.type === 'CLEAR_ALL_DATA') {
    // 先清除配置数据
    ConfigManager.clearAllConfig()
      .then(() => {
        // 再清除历史上报记录
        return ReportHistory.clearAllReports();
      })
      .then(() => {
        // 重置域名状态管理器
        domainStateManager.reset();
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('清除所有数据失败:', error);
        sendResponse({ success: false, message: '清除所有数据失败' });
      });
    
    return true; // 保持消息通道开放，等待异步响应
  }
  
  return false;
}