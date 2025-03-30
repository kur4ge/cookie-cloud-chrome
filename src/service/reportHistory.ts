/**
 * 数据上报管理服务
 * 使用 IndexedDB 存储上报记录
 * 采用单例模式确保只有一个实例
 */

// 数据库配置
const DB_NAME = 'CookieCloudReports';
const DB_VERSION = 1;
const REPORTS_STORE = 'syncReports';

// 上报记录接口
export interface SyncReport {
  id?: number;               // 记录ID（自动生成）
  timestamp: number;         // 上报时间戳
  domain: string;            // 上报域名
  cookieCount: number;       // Cookie数据条数
  headerCount: number;       // 请求头数据条数
  sharedWithKeys: string[];  // 分享的公钥列表
  dataIdentifier: string;     // 加密密钥标识
  success: boolean;          // 上报是否成功
  errorMessage?: string;     // 错误信息（如果上报失败）
}

/**
 * 上报记录查询条件
 */
export interface ReportQueryOptions {
  limit?: number;            // 限制返回记录数量
  offset?: number;           // 跳过记录数量
  startTime?: number;        // 开始时间戳
  endTime?: number;          // 结束时间戳
  domain?: string;           // 指定域名
  publicKey?: string;        // 指定公钥
  success?: boolean;         // 是否成功
}

/**
 * 数据上报管理类 - 单例模式
 */
class ReportHistory {
  private static instance: ReportHistory | null = null;
  private db: IDBDatabase | null = null;

  /**
   * 私有构造函数，防止外部直接创建实例
   */
  private constructor() {}

  /**
   * 获取 ReportHistory 单例
   * @returns ReportHistory 实例
   */
  public static getInstance(): ReportHistory {
    if (!ReportHistory.instance) {
      ReportHistory.instance = new ReportHistory();
    }
    return ReportHistory.instance;
  }

  /**
   * 初始化数据库连接
   * @returns Promise<IDBDatabase>
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('打开数据库失败:', event);
        reject(new Error('打开数据库失败'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建上报记录存储对象
        if (!db.objectStoreNames.contains(REPORTS_STORE)) {
          const store = db.createObjectStore(REPORTS_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // 创建索引
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('success', 'success', { unique: false });
          
          // 复合索引
          store.createIndex('domain_timestamp', ['domain', 'timestamp'], { unique: false });
        }
      };
    });
  }

  /**
   * 添加上报记录
   * @param report 上报记录
   * @returns Promise<number> 新记录的ID
   */
  async addReport(report: Omit<SyncReport, 'id'>): Promise<number> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      
      const request = store.add(report);
      
      request.onsuccess = (event) => {
        const id = request.result as number;
        resolve(id);
      };
      
      request.onerror = (event) => {
        reject(new Error('添加上报记录失败'));
      };
      
      // 添加事务完成监听
      transaction.oncomplete = (event) => {
      };
      
      transaction.onerror = (event) => {
        reject(new Error('上报记录事务失败'));
      };
    });
  }

  /**
   * 获取最近的上报记录
   * @param limit 限制返回的记录数量
   * @returns Promise<SyncReport[]> 上报记录列表
   */
  async getRecentReports(limit: number = 10): Promise<SyncReport[]> {
    return this.queryReports({ limit });
  }

  /**
   * 查询上报记录
   * @param options 查询选项
   * @returns Promise<SyncReport[]> 上报记录列表
   */
  async queryReports(options: ReportQueryOptions = {}): Promise<SyncReport[]> {
    const db = await this.getDB();
    const { 
      limit = 100, 
      offset = 0, 
      startTime, 
      endTime, 
      domain, 
      publicKey,
      success 
    } = options;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      
      let request: IDBRequest;
      const results: SyncReport[] = [];
      
      // 根据查询条件选择合适的索引
      if (domain && !startTime && !endTime) {
        // 按域名查询
        const index = store.index('domain');
        request = index.openCursor(IDBKeyRange.only(domain));
      } else if (startTime || endTime) {
        // 按时间范围查询
        const index = store.index('timestamp');
        let range: IDBKeyRange | null = null;
        
        if (startTime && endTime) {
          range = IDBKeyRange.bound(startTime, endTime);
        } else if (startTime) {
          range = IDBKeyRange.lowerBound(startTime);
        } else if (endTime) {
          range = IDBKeyRange.upperBound(endTime);
        }
        
        request = index.openCursor(range, 'prev'); // 按时间倒序
      } else if (success !== undefined) {
        // 按成功状态查询
        const index = store.index('success');
        request = index.openCursor(IDBKeyRange.only(success));
      } else {
        // 默认按时间倒序
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }
      
      let skipped = 0;
      let collected = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (cursor && collected < limit) {
          const report = cursor.value as SyncReport;
          
          // 处理公钥过滤
          const matchesPublicKey = !publicKey || 
            (report.sharedWithKeys && report.sharedWithKeys.includes(publicKey));
          
          // 处理域名过滤（如果使用了时间范围查询）
          const matchesDomain = !domain || report.domain === domain;
          
          // 处理成功状态过滤（如果使用了其他查询条件）
          const matchesSuccess = success === undefined || report.success === success;
          
          if (matchesPublicKey && matchesDomain && matchesSuccess) {
            if (skipped >= offset) {
              results.push(report);
              collected++;
            } else {
              skipped++;
            }
          }
          
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = (event) => {
        console.error('查询上报记录失败:', event);
        reject(new Error('查询上报记录失败'));
      };
    });
  }

  /**
   * 查询指定公钥的上报记录
   * @param publicKey 公钥
   * @param limit 限制返回的记录数量
   * @returns Promise<SyncReport[]> 上报记录列表
   */
  async getReportsByPublicKey(publicKey: string, limit: number = 50): Promise<SyncReport[]> {
    return this.queryReports({ publicKey, limit });
  }

  /**
   * 查询指定域名的上报记录
   * @param domain 域名
   * @param limit 限制返回的记录数量
   * @returns Promise<SyncReport[]> 上报记录列表
   */
  async getReportsByDomain(domain: string, limit: number = 50): Promise<SyncReport[]> {
    return this.queryReports({ domain, limit });
  }

  /**
   * 查询指定时间范围的上报记录
   * @param startTime 开始时间戳
   * @param endTime 结束时间戳
   * @param limit 限制返回的记录数量
   * @returns Promise<SyncReport[]> 上报记录列表
   */
  async getReportsByTimeRange(
    startTime: number, 
    endTime: number, 
    limit: number = 50
  ): Promise<SyncReport[]> {
    return this.queryReports({ startTime, endTime, limit });
  }

  /**
   * 清除所有上报记录
   * @returns Promise<void>
   */
  async clearAllReports(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('清除上报记录失败:', event);
        reject(new Error('清除上报记录失败'));
      };
    });
  }

  /**
   * 获取上报记录总数
   * @returns Promise<number> 记录总数
   */
  async getReportCount(): Promise<number> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('获取上报记录总数失败:', event);
        reject(new Error('获取上报记录总数失败'));
      };
    });
  }

  /**
   * 获取符合查询条件的上报记录总数
   * @param options 查询选项
   * @returns Promise<number> 记录总数
   */
  async getFilteredReportCount(options: ReportQueryOptions = {}): Promise<number> {
    const db = await this.getDB();
    const { 
      startTime, 
      endTime, 
      domain, 
      publicKey,
      success 
    } = options;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      
      // 如果没有任何筛选条件，直接使用count方法
      if (!startTime && !endTime && !domain && !publicKey && success === undefined) {
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };
        countRequest.onerror = (event) => {
          console.error('获取记录总数失败:', event);
          reject(new Error('获取记录总数失败'));
        };
        return;
      }
      
      // 有筛选条件时，需要遍历所有记录进行计数
      let request: IDBRequest;
      let count = 0;
      
      // 根据查询条件选择合适的索引
      if (domain && !startTime && !endTime) {
        // 按域名查询
        const index = store.index('domain');
        request = index.openCursor(IDBKeyRange.only(domain));
      } else if (startTime || endTime) {
        // 按时间范围查询
        const index = store.index('timestamp');
        let range: IDBKeyRange | null = null;
        
        if (startTime && endTime) {
          range = IDBKeyRange.bound(startTime, endTime);
        } else if (startTime) {
          range = IDBKeyRange.lowerBound(startTime);
        } else if (endTime) {
          range = IDBKeyRange.upperBound(endTime);
        }
        
        request = index.openCursor(range);
      } else if (success !== undefined) {
        // 按成功状态查询
        const index = store.index('success');
        request = index.openCursor(IDBKeyRange.only(success));
      } else {
        // 默认遍历所有记录
        request = store.openCursor();
      }
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (cursor) {
          const report = cursor.value as SyncReport;
          
          // 处理公钥过滤
          const matchesPublicKey = !publicKey || 
            (report.sharedWithKeys && report.sharedWithKeys.includes(publicKey));
          
          // 处理域名过滤（如果使用了时间范围查询）
          const matchesDomain = !domain || report.domain === domain;
          
          // 处理成功状态过滤（如果使用了其他查询条件）
          const matchesSuccess = success === undefined || report.success === success;
          
          if (matchesPublicKey && matchesDomain && matchesSuccess) {
            count++;
          }
          
          cursor.continue();
        } else {
          resolve(count);
        }
      };
      
      request.onerror = (event) => {
        console.error('获取筛选记录总数失败:', event);
        reject(new Error('获取筛选记录总数失败'));
      };
    });
  }

  /**
   * 提取所有上报历史中的对端公钥
   * @returns Promise<string[]> 所有对端公钥列表（去重后）
   */
  async getAllPeerKeys(): Promise<string[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      
      // 使用游标遍历所有记录
      const request = store.openCursor();
      const peerKeysSet = new Set<string>();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        
        if (cursor) {
          const report = cursor.value as SyncReport;
          
          // 将当前记录的所有公钥添加到集合中
          if (report.sharedWithKeys && Array.isArray(report.sharedWithKeys)) {
            report.sharedWithKeys.forEach(key => {
              peerKeysSet.add(key);
            });
          }
          
          cursor.continue();
        } else {
          // 遍历完成，将Set转为数组并返回
          resolve(Array.from(peerKeysSet));
        }
      };
      
      request.onerror = (event) => {
        console.error('提取对端公钥失败:', event);
        reject(new Error('提取对端公钥失败'));
      };
    });
  }
}

// 创建并导出单例实例
const ReportHistoryInstance = ReportHistory.getInstance();
export default ReportHistoryInstance;