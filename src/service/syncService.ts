/**
 * 同步服务
 * 整合域名状态管理、加密处理和API发送功能
 */

import domainStateManager, { DomainData } from './domainState';
import encryptionHandler, { EncryptableDomainData } from '../utils/encryptionHandler';
import cookieCloudApiClient, { CookieCloudDataItem } from '../utils/cookieCloudApiClient';
import ConfigManager from './config';
import ReportManager, { SyncReport } from './reportHistory';

/**
 * 执行数据同步
 * @param sinceLastExtract 是否只同步上次提取后更新的数据
 * @returns Promise<{success: boolean, message?: string}> 同步结果
 */
export async function syncDomainData(sinceLastExtract: boolean = true): Promise<{success: boolean, message?: string}> {
  try {
    // 1. 获取域名状态数据
    const domainDataList = domainStateManager.extractDomainData(sinceLastExtract);
    
    if (domainDataList.length === 0) {
      return { success: true, message: '没有需要同步的数据' };
    }
    
    // 收集同步报告的数组
    const syncReports: Omit<SyncReport, 'id'>[] = [];
    
    // 2. 加密域名数据，添加回调函数收集同步报告
    const encryptedDataMap = await encryptionHandler.encryptDomainDataBatch(
      domainDataList,
      async (encryptableData: EncryptableDomainData, peerPublicKeys: string[], dataIdentifier: string) => {
        // 收集同步报告
        syncReports.push({
          timestamp: Date.now(),
          domain: encryptableData.domain,
          cookieCount: encryptableData.cookies.length,
          headerCount: Object.keys(encryptableData.headers || {}).length,
          sharedWithKeys: peerPublicKeys,
          dataIdentifier, // 记录加密密钥
          success: true // 先假设成功，如果后续失败会更新
        });
        
        return encryptableData; // 返回原始数据，不做修改
      }
    );
    const timestamp = Date.now();
    
    if (encryptedDataMap.size === 0) {
      await ConfigManager.updateBaseConfig({ // 直接成功
        lastSyncTime: timestamp
      });

      return { success: true, message: '没有需要发送的加密数据' };
    }
    
    // 3. 准备API发送的数据格式
    const apiDataMap = new Map<string, CookieCloudDataItem>();
    
    // 获取当前时间戳，用于数据项的时间标记
    
    // 将加密数据转换为API需要的格式
    encryptedDataMap.forEach((encryptedData, key) => {
      apiDataMap.set(key, {
        data: encryptedData,
        timestamp: timestamp
      });
    });
    
    // 4. 发送数据到endpoint
    const result = await cookieCloudApiClient.setData(apiDataMap);
    
    // 5. 如果发送成功，更新最后同步时间
    if (result.success) {
      // 更新最后同步时间
      await ConfigManager.updateBaseConfig({
        lastSyncTime: timestamp
      });
      // 6. 保存所有同步报告
      for (const report of syncReports) {
        await ReportManager.addReport(report);
      }
      
    } else {
      // 如果同步失败，更新报告状态
      for (const report of syncReports) {
        report.success = false;
        report.errorMessage = result.message || '同步失败';
        await ReportManager.addReport(report);
      }
    }
    
    return {
      success: result.success,
      message: result.message
    };
  } catch (error) {
    console.error('同步域名数据失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '同步过程中发生未知错误'
    };
  }
}

/**
 * 检查是否需要同步
 * @returns Promise<boolean> 是否需要同步
 */
export async function shouldSync(): Promise<boolean> {
  // 获取基础配置
  const config = await ConfigManager.getBaseConfig();
  
  // 如果未启用自动同步，则不需要同步
  if (!config.enableAutoSync) {
    return false;
  }
  
  // 如果没有配置endpoint，则不需要同步
  if (!config.endpoint) {
    return false;
  }
  
  // 如果没有私钥，则不需要同步
  const privateKey = await ConfigManager.getPrivateKey();
  if (!privateKey) {
    return false;
  }
  
  // 获取下次同步时间
  const nextSyncTime = await ConfigManager.getNextSyncTime();
  
  // 如果当前时间已经超过下次同步时间，则需要同步
  return Date.now() >= nextSyncTime;
}

export default {
  syncDomainData,
  shouldSync
};