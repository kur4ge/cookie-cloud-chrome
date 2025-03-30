import { handleSyncActions } from './syncActions';
import { handleReportActions } from './reportActions';
import { handleTabActions } from './tabActions';
import { handleDataActions } from './dataActions';

/**
 * 处理所有消息
 * @param message 消息对象
 * @param sender 发送者信息
 * @param sendResponse 响应回调
 * @returns 是否保持消息通道开放
 */
export function handleMessage(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): boolean {
  
  // 验证消息来源是否为同一扩展
  if (!sender.id || sender.id !== chrome.runtime.id) {
    console.warn('拒绝来自其他扩展或页面的消息:', sender);
    sendResponse({ success: false, message: '消息来源不合法' });
    return true;
  }
  
  // 根据消息类型分发到不同的处理函数
  const messageType = message.type || '';
  
  // 同步相关操作
  if (messageType === 'FORCE_SYNC' || messageType === 'NORMAL_SYNC') {
    return handleSyncActions(message, sender, sendResponse);
  }
  
  // 报告相关操作
  if (messageType === 'QUERY_REPORTS' || 
      messageType === 'GET_REPORT_COUNT' || 
      messageType === 'CLEAR_REPORTS' || 
      messageType === 'GET_ALL_PEER_KEYS') {
    return handleReportActions(message, sender, sendResponse);
  }
  
  // Tab相关操作
  if (messageType === 'GET_TAB_DOMAINS' ||
      messageType === 'GET_DOMAIN_DATA') {
    
    return handleTabActions(message, sender, sendResponse);
  }
  
  // 数据管理操作
  if (messageType === 'CLEAR_ALL_DATA') {
    return handleDataActions(message, sender, sendResponse);
  }
  
  // 默认响应
  sendResponse({ error: '未知的消息类型' });
  return true;
}