import domainStateManager from '../service/domainState';

/**
 * 处理Tab相关的消息
 * @param message 消息对象
 * @param sender 发送者信息
 * @param sendResponse 响应回调
 * @returns 是否保持消息通道开放
 */
export function handleTabActions(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): boolean {
  if (message.type === 'GET_TAB_DOMAINS') {
    const tabId = sender?.tab?.id ?? message.tabId; // 优先使用sender中的tabId
    if (!tabId) {
      sendResponse({ success: false, message: '缺少tabId参数' });
      return true;
    }
    const allDomains = new Set<string>();

    // 获取与该tabId相关的所有域名
    const relatedDomains = domainStateManager.getDomainsForTab(tabId);

    // 获取这些域名的所有Cookie
    Promise.all(relatedDomains.map(domain => {
      return chrome.cookies.getAll({ domain });
    }))
    .then(cookieArrays => {
      const allCookies = cookieArrays.flat();
      allCookies.forEach(cookie => {
        if (cookie.domain) {
          allDomains.add(cookie.domain);
        }
      });
      
      sendResponse({
        success: true,
        data: {
          domains: Array.from(allDomains)
        }
      });
    })
    .catch(error => {
      console.error('获取Tab相关Cookie失败:', error);
      sendResponse({ success: false, message: '获取Tab相关Cookie失败' });
    });
    
    return true; // 保持消息通道开放，等待异步响应
  }
  
  // 获取特定域名的详细数据
  if (message.type === 'GET_DOMAIN_DATA') {
    const domain = message.domain;
    if (!domain) {
      sendResponse({ success: false, message: '缺少domain参数' });
      return true;
    }

    try {
      // 从domainStateManager中获取该域名的状态数据
      const domainData = domainStateManager.extractDomainData(false)
        .find(data => data.domain === domain);
      
      // 获取该域名的所有Cookie
      chrome.cookies.getAll({ domain })
        .then(cookies => {
          const filteredCookies = cookies.filter(cookie => {
            return cookie.domain === domain
          });
          sendResponse({
            success: true,
            data: {
              domain,
              cookies: filteredCookies,
              headers: domainData?.headers || {},
            }
          });
        })
        .catch(error => {
          console.error(`获取域名 ${domain} 的Cookie失败:`, error);
          sendResponse({
            success: true,
            data: {
              domain,
              cookies: [],
              headers: domainData?.headers || {},
            }
          });
        });
      
      return true; // 保持消息通道开放，等待异步响应
    } catch (error) {
      console.error(`获取域名 ${domain} 的数据失败:`, error);
      sendResponse({ 
        success: false, 
        message: `获取域名 ${domain} 的数据失败: ${error}` 
      });
      return true;
    }
  }
  
  return false;
}