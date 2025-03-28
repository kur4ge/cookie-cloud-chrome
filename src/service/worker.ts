export { };

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Cookie Cloud 扩展已安装', details);

  // 可以在这里进行初始化操作
  // 例如设置默认配置、清理旧数据等
});

// 监听来自扩展其他部分的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '来自:', sender);
  // 默认响应
  sendResponse({ error: '未知的消息类型' });
  return true;
});

// 监听 cookie 变化
chrome.cookies.onChanged.addListener((changeInfo) => {
  console.log('Cookie 变化:', changeInfo);
  // 可以在这里处理 cookie 变化事件
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    console.log('请求URL:', details.url);
    console.log('请求头:', details.requestHeaders);
    // 这里请求头是没 Cookie 的
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

console.log('Cookie Cloud Service Worker 已启动');
