/**
 * 配置管理服务
 * 使用 Chrome local storage 存储配置
 * 简单配置统一存储在 config 键中
 * 复杂配置按照属性存储在其他键中
 */

import { getKeyPairFromPrivateKey } from '../utils/crypto';

// 基础配置接口
export interface BaseConfig {
  serviceName: string;          // 服务昵称
  lastSyncTime?: number;        // 最后同步时间
  enableAutoSync: boolean;      // 是否启用自动同步
  syncInterval: number;         // 同步间隔（分钟）
  privateKey?: string;          // 私钥
  endpoint?: string;            // 上报数据的接口地址
  enableCookieSync: boolean;    // 是否启用Cookie同步
  enableHeaderSync: boolean;    // 是否启用请求头同步
  includedHeaders?: string[];   // 需要同步的请求头列表
  excludedHeaders?: string[];   // 排除同步的请求头列表
}

// 默认配置
const DEFAULT_CONFIG: BaseConfig = {
  serviceName: '',
  enableAutoSync: false,
  syncInterval: 30,
  endpoint: '',
  enableCookieSync: true,
  enableHeaderSync: true,
  includedHeaders: [],
  excludedHeaders: ['user-agent', 'referer'],
};

// 存储键名定义
export enum StorageKeys {
  BASE = 'config',           // 基础配置
  KEYPAIR = 'keypair',              // 密钥对
  PEER_KEYS = 'peerKeys',           // 对端公钥列表
  COOKIE_RECORDS = 'cookieRecords', // Cookie记录
  PERMISSIONS = 'permissions',      // 权限配置
  DOMAIN_CONFIG = 'domainConfig'    // 域名配置
}

// 对端公钥信息接口
export interface PeerKeyInfo {
  publicKey: string;         // 公钥
  friendlyName: string;      // 友好名称
  addedTime: number;         // 添加时间
  notes?: string;            // 备注
  globalEnabled: boolean;    // 是否全局启用
  disabled: boolean;        // 是否禁用
}



// 域名配置接口
export interface DomainConfig {
  domain: string;               // 域名
  updateTime?: number;          // 最后获取时间
  notes?: string;               // 备注
  additionalPeers?: string[];   // 额外的对端公钥列表（针对此域名特别启用）
  disabledPeers?: string[];     // 禁用的对端公钥列表（针对此域名特别禁用）
  enableCookieSync?: boolean;   // 是否启用Cookie同步（undefined表示继承基础配置）
  enableHeaderSync?: boolean;   // 是否启用请求头同步（undefined表示继承基础配置）
  includedHeaders?: string[];   // 需要同步的请求头列表
  excludedHeaders?: string[];   // 排除同步的请求头列表
}

// 域名状态配置接口（只包含与同步相关的配置）
export interface DomainSyncConfig {
  enableCookieSync: boolean;    // 是否启用Cookie同步
  enableHeaderSync: boolean;    // 是否启用请求头同步
  includedHeaders: string[];    // 需要同步的请求头列表
}
/**
 * 配置管理类
 */
export class ConfigManager {
  /**
   * 获取基础配置
   * @returns Promise<BaseConfig>
   */
  static async getBaseConfig(): Promise<BaseConfig> {
    return new Promise((resolve) => {
      chrome.storage.local.get(StorageKeys.BASE, (result) => {
        const config = result[StorageKeys.BASE] as BaseConfig;
        resolve(config || { ...DEFAULT_CONFIG });
      });
    });
  }

  /**
   * 保存基础配置
   * @param config 配置对象
   * @returns Promise<void>
   */
  static async saveBaseConfig(config: BaseConfig): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [StorageKeys.BASE]: config }, () => {
        resolve();
      });
    });
  }

  /**
   * 更新部分基础配置
   * @param partialConfig 部分配置
   * @returns Promise<BaseConfig> 更新后的完整配置
   */
  static async updateBaseConfig(partialConfig: Partial<BaseConfig>): Promise<BaseConfig> {
    const currentConfig = await this.getBaseConfig();
    const newConfig = { ...currentConfig, ...partialConfig };
    await this.saveBaseConfig(newConfig);
    return newConfig;
  }

  /**
   * 获取私钥
   * @returns Promise<string | null> 私钥，如果不存在则返回null
   */
  static async getPrivateKey(): Promise<string | null> {
    const config = await this.getBaseConfig();
    return config.privateKey || null;
  }

  /**
   * 获取公钥（通过私钥派生）
   * @returns Promise<string | null> 公钥，如果私钥不存在则返回null
   */
  static async getPublicKey(): Promise<string | null> {
    const privateKey = await this.getPrivateKey();
    if (!privateKey) {
      return null;
    }

    try {
      const keyPair = getKeyPairFromPrivateKey(privateKey);
      return keyPair.publicKey;
    } catch (error) {
      console.error('从私钥派生公钥失败:', error);
      return null;
    }
  }

  /**
   * 计算下次同步时间
   * @returns Promise<number> 下次同步的时间戳（毫秒）
   */
  static async getNextSyncTime(): Promise<number> {
    const config = await this.getBaseConfig();
    const now = Date.now();
    // 如果还没有同步过，返回当前时间
    if (!config.lastSyncTime) {
      return now;
    }
    // 计算下次同步时间 = 上次同步时间 + 同步间隔（分钟转毫秒）
    const nextSyncTime = config.lastSyncTime + (config.syncInterval * 60 * 1000);
    // 如果下次同步时间已经过去，则返回当前时间
    return nextSyncTime > now ? nextSyncTime : now;
  }

  /**
   * 获取指定键的配置
   * @param key 存储键名
   * @returns Promise<T | null>
   */
  static async getConfig<T>(key: StorageKeys): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] as T || null);
      });
    });
  }

  /**
   * 保存指定键的配置
   * @param key 存储键名
   * @param value 配置值
   * @returns Promise<void>
   */
  static async saveConfig<T>(key: StorageKeys, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }


  /**
   * 清除所有配置
   * @returns Promise<void>
   */
  static async clearAllConfig(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }

  /**
   * 监听配置变化
   * @param key 存储键名
   * @param callback 回调函数
   */
  static watchConfig(key: StorageKeys, callback: (newValue: any, oldValue: any) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[key]) {
        callback(changes[key].newValue, changes[key].oldValue);
      }
    });
  }

  /**
   * 获取所有对端公钥
   * @returns Promise<PeerKeyInfo[]> 对端公钥列表
   */
  static async getAllPeerKeys(): Promise<PeerKeyInfo[]> {
    const peerKeys = await this.getConfig<PeerKeyInfo[]>(StorageKeys.PEER_KEYS);
    return peerKeys || [];
  }

  /**
   * 添加对端公钥
   * @param peerKeyInfo 对端公钥信息
   * @returns Promise<PeerKeyInfo[]> 更新后的对端公钥列表
   */
  static async addPeerKey(peerKeyInfo: Omit<PeerKeyInfo, 'addedTime'>): Promise<PeerKeyInfo[]> {
    const peerKeys = await this.getAllPeerKeys();

    // 检查是否已存在相同公钥
    const existingIndex = peerKeys.findIndex(key => key.publicKey === peerKeyInfo.publicKey);
    if (existingIndex >= 0) {
      throw new Error('该公钥已存在');
    }

    // 添加新公钥，设置添加时间
    const newPeerKey: PeerKeyInfo = {
      ...peerKeyInfo,
      addedTime: Date.now()
    };

    const updatedPeerKeys = [...peerKeys, newPeerKey];
    await this.saveConfig(StorageKeys.PEER_KEYS, updatedPeerKeys);
    return updatedPeerKeys;
  }

  /**
   * 更新对端公钥信息
   * @param publicKey 要更新的公钥
   * @param updates 更新的字段
   * @returns Promise<PeerKeyInfo | null> 更新后的公钥信息，如果未找到则返回null
   */
  static async updatePeerKey(
    publicKey: string,
    updates: Partial<Omit<PeerKeyInfo, 'publicKey' | 'addedTime'>>
  ): Promise<PeerKeyInfo | null> {
    const peerKeys = await this.getAllPeerKeys();
    const keyIndex = peerKeys.findIndex(key => key.publicKey === publicKey);

    if (keyIndex === -1) {
      return null;
    }

    // 更新公钥信息
    peerKeys[keyIndex] = {
      ...peerKeys[keyIndex],
      ...updates
    };

    await this.saveConfig(StorageKeys.PEER_KEYS, peerKeys);
    return peerKeys[keyIndex];
  }

  /**
   * 删除对端公钥
   * @param publicKey 要删除的公钥
   * @returns Promise<boolean> 是否成功删除
   */
  static async deletePeerKey(publicKey: string): Promise<boolean> {
    const peerKeys = await this.getAllPeerKeys();
    const initialLength = peerKeys.length;

    const filteredKeys = peerKeys.filter(key => key.publicKey !== publicKey);

    if (filteredKeys.length === initialLength) {
      return false; // 没有找到要删除的公钥
    }

    await this.saveConfig(StorageKeys.PEER_KEYS, filteredKeys);
    return true;
  }

  /**
   * 获取指定公钥信息
   * @param publicKey 公钥
   * @returns Promise<PeerKeyInfo | null> 公钥信息，如果不存在则返回null
   */
  static async getPeerKeyInfo(publicKey: string): Promise<PeerKeyInfo | null> {
    const peerKeys = await this.getAllPeerKeys();
    return peerKeys.find(key => key.publicKey === publicKey) || null;
  }

  /**
   * 获取所有全局启用的对端公钥
   * @returns Promise<PeerKeyInfo[]> 启用的对端公钥列表
   */
  static async getGlobalEnabledPeerKeys(): Promise<PeerKeyInfo[]> {
    const peerKeys = await this.getAllPeerKeys();
    return peerKeys.filter(key => key.globalEnabled && !key.disabled);
  }

  /**
   * 获取所有域名配置
   * @returns Promise<DomainConfig[]> 域名配置列表
   */
  static async getAllDomainConfigs(): Promise<DomainConfig[]> {
    const domainConfigs = await this.getConfig<DomainConfig[]>(StorageKeys.DOMAIN_CONFIG);
    return domainConfigs || [];
  }

  /**
   * 获取指定域名的配置
   * @param domain 域名
   * @returns Promise<DomainConfig | null> 域名配置，如果不存在则返回null
   */
  static async getDomainConfig(domain: string): Promise<DomainConfig | null> {
    const domainConfigs = await this.getAllDomainConfigs();
    return domainConfigs.find(config => config.domain === domain) || null;
  }

  /**
 * 获取域名同步配置
 * @param domain 域名
 * @returns Promise<DomainSyncConfig> 域名同步配置
 */
  static async getDomainSyncConfig(domain: string): Promise<DomainSyncConfig> {
    // 获取基础配置
    const baseConfig = await this.getBaseConfig();
    
    // 获取域名配置
    const domainConfig = await this.getDomainConfig(domain);
        
    // 合并基础配置和域名配置
    const syncConfig: DomainSyncConfig = {
      // 如果域名配置存在且值不是undefined，使用域名配置的值，否则使用基础配置的值
      enableCookieSync: domainConfig?.enableCookieSync !== undefined 
        ? domainConfig.enableCookieSync 
        : baseConfig.enableCookieSync,
      enableHeaderSync: domainConfig?.enableHeaderSync !== undefined 
        ? domainConfig.enableHeaderSync 
        : baseConfig.enableHeaderSync,
      
      // 计算includedHeaders: (baseConfig.includedHeaders - domainConfig.excludedHeaders - baseConfig.excludedHeaders) + domainConfig.includedHeaders
      includedHeaders: [
        // 从baseConfig.includedHeaders中过滤掉在domainConfig.excludedHeaders和baseConfig.excludedHeaders中的项
        ...(baseConfig.includedHeaders || []).filter(header => 
          !(domainConfig?.excludedHeaders || []).includes(header) && 
          !(baseConfig.excludedHeaders || []).includes(header)
        ),
        // 添加domainConfig.includedHeaders
        ...(domainConfig?.includedHeaders || [])
      ].filter((value, index, self) => self.indexOf(value) === index), // 去重
    };
    
    return syncConfig;
  }
  

  /**
   * 获取指定域名可用的对端公钥列表
   * @param domain 域名
   * @returns Promise<PeerKeyInfo[]> 可用的对端公钥列表
   */
  static async getDomainPeerKeys(domain: string): Promise<PeerKeyInfo[]> {
    // 获取所有全局启用且未被禁用的公钥
    const globalEnabledKeys = await this.getGlobalEnabledPeerKeys();
    
    // 获取域名配置
    const domainConfig = await this.getDomainConfig(domain);
    if (!domainConfig) {
      // 如果没有域名配置，只返回全局启用的公钥
      return globalEnabledKeys;
    }
    
    // 获取所有公钥
    const allPeerKeys = await this.getAllPeerKeys();
    
    // 获取额外启用的公钥
    const additionalPeerKeys: PeerKeyInfo[] = [];
    if (domainConfig.additionalPeers && domainConfig.additionalPeers.length > 0) {
      for (const publicKey of domainConfig.additionalPeers) {
        const peerKey = allPeerKeys.find(key => key.publicKey === publicKey);
        if (peerKey && !peerKey.disabled) {
          additionalPeerKeys.push(peerKey);
        }
      }
    }
    
    // 合并全局启用的公钥和额外启用的公钥
    let resultKeys = [...globalEnabledKeys, ...additionalPeerKeys];
    
    // 排除域名特别禁用的公钥
    if (domainConfig.disabledPeers && domainConfig.disabledPeers.length > 0) {
      resultKeys = resultKeys.filter(key => !domainConfig.disabledPeers?.includes(key.publicKey));
    }
    
    // 去重
    const uniqueKeys = resultKeys.reduce((acc, current) => {
      const x = acc.find(item => item.publicKey === current.publicKey);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as PeerKeyInfo[]);
    
    return uniqueKeys;
  }

  /**
   * 创建或更新域名配置
   * @param domain 域名
   * @param configData 配置数据（不包含域名字段）
   * @returns Promise<DomainConfig> 更新后的域名配置
   */
  static async addOrUpdateDomainConfig(
    domain: string,
    configData: Partial<Omit<DomainConfig, 'domain'>>
  ): Promise<DomainConfig> {
    const domainConfigs = await this.getAllDomainConfigs();
    const configIndex = domainConfigs.findIndex(config => config.domain === domain);

    // 默认域名配置
    const defaultDomainConfig: Omit<DomainConfig, 'domain'> = {
      enableCookieSync: true,
      enableHeaderSync: true,
      includedHeaders: [],
      excludedHeaders: [],
    };

    if (configIndex >= 0) {
      // 更新现有配置
      const updatedConfig = {
        ...domainConfigs[configIndex],
        ...configData
      };

      domainConfigs[configIndex] = updatedConfig;
      await this.saveConfig(StorageKeys.DOMAIN_CONFIG, domainConfigs);
      return updatedConfig;
    } else {
      // 创建新配置
      const newConfig: DomainConfig = {
        domain,
        ...defaultDomainConfig,
        ...configData
      };

      const updatedDomainConfigs = [...domainConfigs, newConfig];
      await this.saveConfig(StorageKeys.DOMAIN_CONFIG, updatedDomainConfigs);
      return newConfig;
    }
  }

  /**
   * 删除域名配置
   * @param domain 要删除的域名
   * @returns Promise<boolean> 是否成功删除
   */
  static async deleteDomainConfig(domain: string): Promise<boolean> {
    const domainConfigs = await this.getAllDomainConfigs();
    const initialLength = domainConfigs.length;

    const filteredConfigs = domainConfigs.filter(config => config.domain !== domain);

    if (filteredConfigs.length === initialLength) {
      return false; // 没有找到要删除的域名配置
    }

    await this.saveConfig(StorageKeys.DOMAIN_CONFIG, filteredConfigs);
    return true;
  }

  /**
   * 获取指定时间范围内有获取记录的域名配置
   * @param startTime 开始时间戳
   * @param endTime 结束时间戳
   * @returns Promise<DomainConfig[]> 符合条件的域名配置列表
   */
  static async getDomainConfigsByTimeRange(
    startTime: number,
    endTime: number = Date.now()
  ): Promise<DomainConfig[]> {
    const domainConfigs = await this.getAllDomainConfigs();
    return domainConfigs.filter(config => {
      return config.updateTime &&
        config.updateTime >= startTime &&
        config.updateTime <= endTime;
    });
  }
}

// 导出默认实例
export default ConfigManager;