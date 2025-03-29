/**
 * 域名数据状态管理
 * 管理域名相关的Cookie变更、请求头信息和Tab访问记录
 */


// 域名状态接口
interface DomainState {
  domain: string;                           // 域名
  cookieUpdated: boolean;                   // Cookie是否有更新
  headers: Map<string, string>;             // 请求头信息 (key -> value)
  updatedHeaderKeys: Set<string>;           // 更新的请求头key列表
  accessTabs: Set<number>;                  // 访问该域名的Tab ID集合
  lastUpdate: number;                       // 最后更新时间
}

// 提取的域名数据接口
export interface DomainData {
  domain: string;                           // 域名
  cookieUpdated: boolean;                   // Cookie是否有更新
  headers: Record<string, string>;          // 请求头信息
  updatedHeaderKeys: string[];              // 更新的请求头key列表
  accessTabs: number[];                     // 访问该域名的Tab ID列表
  lastUpdate: number;                       // 最后更新时间
}

/**
 * 域名数据状态管理类
 */
export class DomainStateManager {
  private static instance: DomainStateManager;
  private domainStates: Map<string, DomainState> = new Map();
  private lastExtractTime: number = 0;

  // 私有构造函数，确保单例模式
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): DomainStateManager {
    if (!DomainStateManager.instance) {
      DomainStateManager.instance = new DomainStateManager();
    }
    return DomainStateManager.instance;
  }

  /**
   * 从URL中提取域名
   * @param url URL地址
   * @returns 域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('提取域名失败:', error);
      return '';
    }
  }

  /**
   * 获取或创建域名状态
   * @param domain 域名
   * @returns 域名状态对象
   */
  private getOrCreateDomainState(domain: string): DomainState {
    if (!this.domainStates.has(domain)) {
      this.domainStates.set(domain, {
        domain,
        cookieUpdated: false,
        headers: new Map<string, string>(),
        updatedHeaderKeys: new Set<string>(),
        accessTabs: new Set<number>(),
        lastUpdate: Date.now()
      });
    }
    return this.domainStates.get(domain)!;
  }

  /**
   * 处理Cookie变更
   * @param changeInfo Cookie变更信息
   */
  public handleCookieChange(changeInfo: chrome.cookies.CookieChangeInfo): void {
    const { cookie } = changeInfo;
    const domainState = this.getOrCreateDomainState(cookie.domain);
    domainState.cookieUpdated = true;
  }

  /**
   * 处理请求头信息
   * @param details 请求详情
   */
  public handleRequestHeaders(details: chrome.webRequest.WebRequestHeadersDetails): void {
    const domain = this.extractDomain(details.url);
    if (!domain) return;
    
    const domainState = this.getOrCreateDomainState(domain);
    
    // 记录Tab ID
    if (details.tabId > 0) {
      domainState.accessTabs.add(details.tabId);
    }
    
    // 记录请求头
    if (details.requestHeaders) {
      for (const header of details.requestHeaders) {
        if (header.name && header.value) {
          const headerKey = header.name.toLowerCase();
          // 如果header值发生变化或是新增的header，记录到updatedHeaderKeys中
          const oldValue = domainState.headers.get(headerKey);
          if (oldValue !== header.value) {
            domainState.updatedHeaderKeys.add(headerKey);
          }
          domainState.headers.set(headerKey, header.value);
        }
      }
    }
    
    domainState.lastUpdate = Date.now();
  }

  /**
   * 提取域名数据
   * @param sinceLastExtract 是否只提取上次提取后更新的数据
   * @returns 域名数据列表
   */
  public extractDomainData(sinceLastExtract: boolean = true): DomainData[] {
    const result: DomainData[] = [];
    const now = Date.now();
    
    if (sinceLastExtract) {
      // 只提取上次提取后更新的数据
      this.domainStates.forEach((state, domain) => {
        if (state.lastUpdate > this.lastExtractTime) {
          result.push({
            domain: state.domain,
            cookieUpdated: state.cookieUpdated,
            headers: Object.fromEntries(state.headers),
            updatedHeaderKeys: Array.from(state.updatedHeaderKeys),
            accessTabs: Array.from(state.accessTabs),
            lastUpdate: state.lastUpdate
          });
          
          state.cookieUpdated = false;
          state.updatedHeaderKeys.clear();
        }
      });
    } else {
      // 强制提取所有数据
      this.domainStates.forEach((state, domain) => {
        result.push({
          domain: state.domain,
          cookieUpdated: true, // 强制提取时标记为需要更新
          headers: Object.fromEntries(state.headers),
          updatedHeaderKeys: Array.from(state.headers.keys()), // 强制提取时所有header都视为已更新
          accessTabs: Array.from(state.accessTabs),
          lastUpdate: state.lastUpdate
        });
        
        state.cookieUpdated = false;
        state.updatedHeaderKeys.clear();
      });
    }
    
    // 更新最后提取时间
    this.lastExtractTime = now;
    return result;
  }

  /**
   * 清理过期数据
   * @param maxAgeMs 最大保留时间(毫秒)，默认24小时
   */
  public cleanupExpiredData(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const expireTime = now - maxAgeMs;
    
    this.domainStates.forEach((state, domain) => {
      if (state.lastUpdate < expireTime) {
        this.domainStates.delete(domain);
      }
    });
  }

  /**
   * 重置状态管理器
   */
  public reset(): void {
    this.domainStates.clear();
    this.lastExtractTime = Date.now();
  }
}

// 导出单例实例
export default DomainStateManager.getInstance();