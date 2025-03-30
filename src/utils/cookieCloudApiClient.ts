/**
 * CookieCloud API 交互工具
 */

import ConfigManager from '../service/config';

// 定义数据项接口
export interface CookieCloudDataItem {
  data: any;
  [key: string]: any; // 允许其他字段
}

/**
 * CookieCloud API 客户端类
 */
export class CookieCloudApiClient {
  /**
   * 获取配置的endpoint地址
   * @returns Promise<string | null> endpoint地址，如果未配置则返回null
   */
  private async getEndpoint(): Promise<string | null> {
    const config = await ConfigManager.getBaseConfig();
    return config.endpoint || null;
  }

  /**
   * 向 endpoint 发送数据
   * @param dataMap 数据映射表，key为字符串，value包含data字段
   * @returns Promise<{success: boolean, message?: string}> 操作结果
   */
  async setData(
    dataMap: Map<string, CookieCloudDataItem>
  ): Promise<{success: boolean, message?: string}> {
    try {
      // 获取配置的endpoint地址
      const endpoint = await this.getEndpoint();
      
      if (!endpoint) {
        return { 
          success: false, 
          message: '未配置endpoint地址' 
        };
      }
      
      // 构建完整的API URL
      const apiUrl = `${endpoint}/set`;
      
      // 将Map转换为对象
      const dataObject: Record<string, CookieCloudDataItem> = {};
      dataMap.forEach((value, key) => {
        dataObject[key] = value;
      });
      
      // 发送请求
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({data: dataObject})
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const result = await response.json();
      return { 
        success: true,
        message: result.message || '数据发送成功'
      };
    } catch (error) {
      console.error('发送数据到endpoint失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
}

// 导出默认实例
const cookieCloudApiClient = new CookieCloudApiClient();
export default cookieCloudApiClient;
