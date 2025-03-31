import syncService from '../service/syncService';

/**
 * 处理同步相关的消息
 * @param message 消息对象
 * @param sender 发送者信息
 * @param sendResponse 响应回调
 * @returns 是否保持消息通道开放
 */
export function handleSyncActions(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): boolean {
  if (message.type === 'FORCE_SYNC') {
    // 执行强制同步
    syncService.syncDomainData(false) // 同步所有数据，不仅是上次提取后的
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('强制同步失败:', error);
        sendResponse({ success: false, message: '同步过程中发生错误' });
      });
    return true; // 保持消息通道开放，等待异步响应
  } 
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
  
  return false;
}