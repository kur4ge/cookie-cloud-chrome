/**
 * 加密处理工具
 * 用于处理域名数据的加密和传输
 */

import { encryptAndSignForMultipleRecipients } from './crypto';
import ConfigManager from '../service/config';
import { DomainData } from '../service/domainState';
import * as CryptoJS from 'crypto-js';

// 定义要加密的域名数据结构
export interface EncryptableDomainData {
    domain: string;                                 // 域名
    cookies: chrome.cookies.Cookie[]; // Cookie是否有更新
    headers: Record<string, string>;                // 选择性包含的请求头
}

/**
 * 计算密钥标识
 * @param publicKey 公钥
 * @param domain 域名
 * @param name 名称
 * @returns SHA256哈希值
 */
function calculateKeyIdentifier(publicKey: string, domain: string, name: string): string {
    // 使用 CryptoJS 计算 SHA256 哈希
    const data = `${publicKey}:${domain}:${name}`;
    const hash = CryptoJS.SHA256(data).toString();
    return hash;
}

/**
 * 从域名数据中提取需要加密的信息
 * @param domainData 域名状态管理器返回的单条数据
 * @returns 处理后可加密的域名数据
 */
export async function prepareDomainDataForEncryption(
    domainData: DomainData
): Promise<EncryptableDomainData | null> {
    // 获取域名配置
    const domainConfig = await ConfigManager.getDomainConfig(domainData.domain);

    // 提取需要的请求头
    const selectedHeaders: Record<string, string> = {};

    // 默认包含的请求头列表
    const headersToInclude = domainConfig?.remoteConfig?.headers || [];

    // 检查是否有需要上报的header
    let hasReportableHeaders = false;

    // 检查更新的header是否在需要上报的列表中
    if (domainData.updatedHeaderKeys && domainData.updatedHeaderKeys.length > 0) {
        for (const updatedKey of domainData.updatedHeaderKeys) {
            if (headersToInclude.includes(updatedKey)) {
                hasReportableHeaders = true;
                break;
            }
        }
    }

    // 如果cookie没有更新，并且没有需要上报的header，则直接返回null
    if (!domainData.cookieUpdated && !hasReportableHeaders) {
        return null;
    }

    // 从所有请求头中筛选需要的
    for (const headerKey of headersToInclude) {
        if (domainData.headers[headerKey]) {
            selectedHeaders[headerKey] = domainData.headers[headerKey];
        }
    }

    let cookies: chrome.cookies.Cookie[] = []
    if (domainData.cookieUpdated) {
        try {
            // 使用chrome API获取域名的所有cookie
            const allCookies = await chrome.cookies.getAll({ domain: domainData.domain });

            // 过滤出域名完全匹配的cookie
            cookies = allCookies.filter(cookie => {
                return cookie.domain === domainData.domain;
            });

        } catch (error) {
            console.error(`获取域名 ${domainData.domain} 的cookie失败:`, error);
        }
    }

    // 构建可加密的域名数据
    return {
        domain: domainData.domain,
        cookies,
        headers: selectedHeaders,
    };
}

/**
 * 获取用于加密的对端公钥列表
 * @param domain 域名 (可选，用于获取特定域名的公钥配置)
 * @returns 启用的对端公钥列表
 */
export async function getEnabledPeerPublicKeys(domain?: string): Promise<string[]> {
    if (domain) {
        const domainPeerKeys = await ConfigManager.getDomainPeerKeys(domain);
        return domainPeerKeys.map(keyInfo => keyInfo.publicKey);
    } else {
        // 如果没有指定域名，则只获取全局启用且未被禁用的公钥
        const enabledPeerKeys = await ConfigManager.getGlobalEnabledPeerKeys();
        return enabledPeerKeys.map(keyInfo => keyInfo.publicKey);
    }
}

/**
 * 加密多个域名数据
 * @param domainDataList 域名数据列表
 * @param preProcessCallback 加密前的数据预处理回调函数（可选）
 * @returns 加密后的数据映射表 (域名 -> 加密数据)
 */
export async function encryptDomainDataBatch(
    domainDataList: DomainData[],
    preProcessCallback?: (data: EncryptableDomainData, peerPublicKeys: string[], encryptionKey: string) => Promise<EncryptableDomainData> | EncryptableDomainData
): Promise<Map<string, string>> {
    // 获取私钥
    const privateKey = await ConfigManager.getPrivateKey();
    const config = await ConfigManager.getBaseConfig();
    const serviceName = config.serviceName || '';
    if (!privateKey) {
        throw new Error('未找到私钥，无法加密数据');
    }
    const myPublicKey = await ConfigManager.getPublicKey();
    if (!myPublicKey) {
        throw new Error('无法获取本地公钥');
    }
    const encryptedDataMap = new Map<string, string>();

    // 处理每个域名数据
    for (const domainData of domainDataList) {
        try {
            // 获取该域名的对端公钥
            const peerPublicKeys = await getEnabledPeerPublicKeys(domainData.domain);
            // 使用calculateKeyIdentifier生成唯一键
            const encryptionKey = calculateKeyIdentifier(myPublicKey, domainData.domain, serviceName);

            // 如果没有对端公钥，跳过加密
            if (peerPublicKeys.length === 0) {
                continue;
            }

            // 准备加密数据
            let encryptableData = await prepareDomainDataForEncryption(domainData);
            // 如果提供了预处理回调，则应用预处理，并传递加密密钥
            if (encryptableData && preProcessCallback) {
                encryptableData = await Promise.resolve(preProcessCallback(encryptableData, peerPublicKeys, encryptionKey));
            }

            if (!encryptableData) {
                continue;
            }
            // 删除 encryptableData 中的 domain 属性
            const { domain, ...restData } = encryptableData;

            // 将数据转为JSON字符串
            const jsonData = JSON.stringify(restData);

            // 使用多接收者加密
            const encryptedData = encryptAndSignForMultipleRecipients(
                peerPublicKeys,
                privateKey,
                jsonData
            );

            // 存储加密结果，使用生成的唯一键而不是域名
            encryptedDataMap.set(encryptionKey, encryptedData);
        } catch (error) {
            console.error(`加密域名 ${domainData.domain} 数据失败:`, error);
        }
    }

    return encryptedDataMap;
}


export default {
    prepareDomainDataForEncryption,
    getEnabledPeerPublicKeys,
    encryptDomainDataBatch,
    calculateKeyIdentifier,
};