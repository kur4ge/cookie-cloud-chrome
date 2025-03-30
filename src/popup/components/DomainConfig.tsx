import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Table, 
  Switch, 
  Typography, 
  Space, 
  Tag, 
  Empty,
  Radio
} from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.css';
import { IconSettings, IconSync, IconClockCircle, IconClose } from '@arco-design/web-react/icon';
import ConfigManager, { PeerKeyInfo, DomainSyncConfig, DomainConfig } from '../../service/config';

const { Text, Paragraph } = Typography;
const TabPane = Tabs.TabPane;
const RadioGroup = Radio.Group;

// 对端配置类型
type ConfigType = 'allow' | 'deny' | 'default';

// 对端信息接口
interface PeerInfo {
  key: string;
  name: string;
  publicKey: string;
  config: ConfigType;
}

// Header
interface HeaderItem {
  key: string;
  value: string;
  config: ConfigType;
}
// 域名数据接口
interface DomainData {
  domain: string;
  cookies: chrome.cookies.Cookie[];
  headers: HeaderItem[];
}

interface DomainConfigProps {
  domain: string;
}

const DomainConfigUI: React.FC<DomainConfigProps> = ({ domain }) => {
  const [sendCookies, setSendCookies] = useState<ConfigType>('default');
  const [sendHeaders, setSendHeaders] = useState<ConfigType>('default');
  const [peerConfigs, setPeerConfigs] = useState<PeerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainData, setDomainData] = useState<DomainData | null>(null);

  // 获取域名数据和对端密钥
  useEffect(() => {
    setLoading(true);
    
    // 获取域名同步配置
    const loadSyncConfig = async () => {
      try {
        const config = await ConfigManager.getDomainConfig(domain);
        
        // 设置Cookie同步状态
        if (config?.enableCookieSync === true) {
          setSendCookies('allow');
        } else if (config?.enableCookieSync === false) {
          setSendCookies('deny');
        } else {
          setSendCookies('default');
        }
        
        // 设置Header同步状态
        if (config?.enableHeaderSync === true) {
          setSendHeaders('allow');
        } else if (config?.enableHeaderSync === false) {
          setSendHeaders('deny');
        } else {
          setSendHeaders('default');
        }
      } catch (error) {
        console.error('获取域名同步配置失败:', error);
      }
    };
    
    loadSyncConfig();

    // 获取域名详细数据
    chrome.runtime.sendMessage(
      { type: 'GET_DOMAIN_DATA', domain },
      async (response) => {
        const domainConfig = await ConfigManager.getDomainConfig(domain);

        if (response && response.success && response.data) {
          // 将headers对象转换为数组格式
          const headersArray = response.data.headers 
            ? Object.entries(response.data.headers).map(([key, value]) => {
                // 检查此请求头是否在包含列表或排除列表中
                const isIncluded = domainConfig?.includedHeaders?.includes(key) || false;
                const isExcluded = domainConfig?.excludedHeaders?.includes(key) || false;
                // 确定此请求头的配置状态
                let headerConfig: ConfigType = 'default';
                if (isIncluded) {
                  headerConfig = 'allow';
                } else if (isExcluded) {
                  headerConfig = 'deny';
                }
                return {
                  key,
                  value: value as string,
                  config: headerConfig
                };
              })
            : [];
          
          setDomainData({
            domain: response.data.domain,
            cookies: response.data.cookies || [],
            headers: headersArray,
          });
        }
        
        try {
          // 获取当前域名配置
          
          // 直接从ConfigManager获取对端密钥
          const peerKeys = await ConfigManager.getAllPeerKeys();
          
          // 初始化对端配置
          const initialPeerConfigs = peerKeys.map((peerKey: PeerKeyInfo) => {
            // 检查此对端是否在域名的additionalPeers中（特别允许）
            const isAdditionalPeer = domainConfig?.additionalPeers?.includes(peerKey.publicKey) || false;
            
            // 检查此对端是否在域名的disabledPeers中（特别禁用）
            const isDisabledPeer = domainConfig?.disabledPeers?.includes(peerKey.publicKey) || false;
            
            // 确定此对端的配置状态
            let peerConfig: ConfigType = 'default';
            
            if (isAdditionalPeer) {
              peerConfig = 'allow';
            } else if (isDisabledPeer) {
              peerConfig = 'deny';
            } 
            
            return {
              key: peerKey.publicKey,
              name: peerKey.friendlyName || `对端 ${peerKey.publicKey.substring(0, 8)}`,
              publicKey: peerKey.publicKey,
              config: peerConfig
            };
          });
          
          setPeerConfigs(initialPeerConfigs);
        } catch (error) {
          console.error('获取对端密钥失败:', error);
        } finally {
          setLoading(false);
        }
      }
    );
  }, [domain]);

  // 处理Cookie同步配置变化
  const handleCookieSyncChange = async (value: ConfigType) => {
    setSendCookies(value);
    try {
      // 获取当前域名配置
      const domainConfig = await ConfigManager.getDomainConfig(domain) || { domain };
      
      // 准备更新的配置对象
      const updateConfig: Partial<Omit<DomainConfig, 'domain'>> = {
        updateTime: Date.now()
      };
      
      // 根据选择的值设置enableCookieSync
      if (value === 'allow') {
        updateConfig.enableCookieSync = true;
      } else if (value === 'deny') {
        updateConfig.enableCookieSync = false;
      } else {
        // 默认状态下，删除特定设置，使用全局设置
        updateConfig.enableCookieSync = undefined;
      }
      
      // 更新域名配置
      await ConfigManager.addOrUpdateDomainConfig(domain, updateConfig);
    } catch (error) {
      console.error('更新Cookie同步设置失败:', error);
    }
  };

  // 处理请求头同步配置变化
  const handleHeaderSyncChange = async (value: ConfigType) => {
    setSendHeaders(value);
    try {
      // 获取当前域名配置
      const domainConfig = await ConfigManager.getDomainConfig(domain) || { domain };
      
      // 准备更新的配置对象
      const updateConfig: Partial<Omit<DomainConfig, 'domain'>> = {
        updateTime: Date.now()
      };
      
      // 根据选择的值设置enableHeaderSync
      if (value === 'allow') {
        updateConfig.enableHeaderSync = true;
      } else if (value === 'deny') {
        updateConfig.enableHeaderSync = false;
      } else {
        // 默认状态下，删除特定设置，使用全局设置
        updateConfig.enableHeaderSync = undefined;
      }
      
      // 更新域名配置
      await ConfigManager.addOrUpdateDomainConfig(domain, updateConfig);
    } catch (error) {
      console.error('更新请求头同步设置失败:', error);
    }
  };

  // 定义Cookie表格列
  const cookieColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }}>
          {value}
        </Text>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }}>
          {value}
        </Text>
      ),
    },
  ];

  // 定义Header表格列
  const headerColumns = [
    {
      title: '-',
      dataIndex: 'uploaded',
      key: 'uploaded',
      width: 40,
      render: (uploaded: boolean) => (
        <div style={{ textAlign: 'center' }}>
          {uploaded ? 
            <IconSync style={{ color: '#4CAF50' }} /> : 
            <IconClockCircle style={{ color: '#FFC107' }} />
          }
        </div>
      ),
    },
    {
      title: '名称',
      dataIndex: 'key',
      key: 'key',
      width: 120,
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }}>
          {value}
        </Text>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }}>
          {value}
        </Text>
      ),
    },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      width: 144,
      render: (config: ConfigType, record: HeaderItem) => (
        <RadioGroup
          type="button"
          name={`header-config-${record.key}`}
          value={config}
          onChange={(value) => handleHeaderConfigChange(record.key, value)}
        >
          <Radio value="allow">允</Radio>
          <Radio value="deny">禁</Radio>
          <Radio value="default">默</Radio>
        </RadioGroup>
      ),
    },
  ];

  // 定义对端表格列
  const peerColumns = [
    {
      title: '-',
      dataIndex: 'uploaded',
      key: 'uploaded',
      width: 40,
      render: (uploaded: boolean) => (
        <div style={{ textAlign: 'center' }}>
          {uploaded ? 
            <IconSync style={{ color: '#4CAF50' }} /> : 
            <IconClockCircle style={{ color: '#FFC107' }} />
          }
        </div>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '公钥',
      dataIndex: 'publicKey',
      key: 'publicKey',
      render: (value: string) => (
        <Text ellipsis={{ showTooltip: true }}>
          {'0x' + value}
        </Text>
      ),
    },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      width: 144,
      render: (config: ConfigType, record: PeerInfo) => (
        <RadioGroup
          type="button"
          name={`peer-config-${record.name}`}
          value={config}
          onChange={(value) => handlePeerConfigChange(record.key, value)}
        >
          <Radio value="allow">允</Radio>
          <Radio value="deny">禁</Radio>
          <Radio value="default">默</Radio>
        </RadioGroup>
      ),
    },
  ];

  // 处理请求头配置变化
  const handleHeaderConfigChange = async (headerKey: string, value: ConfigType) => {
    // 更新本地状态，使界面立即响应
    setDomainData(prevData => {
      if (!prevData) return null;
      
      return {
        ...prevData,
        headers: prevData.headers.map(header => 
          header.key === headerKey ? { ...header, config: value } : header
        )
      };
    });
    
    // 根据选择的值更新ConfigManager中的配置
    try {
      // 获取当前域名配置
      const domainConfig = await ConfigManager.getDomainConfig(domain) || { domain };
      
      // 准备更新的配置对象
      const updateConfig: Partial<Omit<DomainConfig, 'domain'>> = {
        updateTime: Date.now()
      };
      
      if (value === 'allow') {
        // 允许: 添加到includedHeaders，从excludedHeaders中移除
        updateConfig.includedHeaders = [
          ...(domainConfig.includedHeaders || []).filter(key => key !== headerKey),
          headerKey
        ];
        updateConfig.excludedHeaders = (domainConfig.excludedHeaders || []).filter(key => key !== headerKey);
      } else if (value === 'deny') {
        // 禁止: 添加到excludedHeaders，从includedHeaders中移除
        updateConfig.excludedHeaders = [
          ...(domainConfig.excludedHeaders || []).filter(key => key !== headerKey),
          headerKey
        ];
        updateConfig.includedHeaders = (domainConfig.includedHeaders || []).filter(key => key !== headerKey);
      } else {
        // 默认: 从两个列表中都移除
        updateConfig.includedHeaders = (domainConfig.includedHeaders || []).filter(key => key !== headerKey);
        updateConfig.excludedHeaders = (domainConfig.excludedHeaders || []).filter(key => key !== headerKey);
      }
      
      // 更新域名配置
      await ConfigManager.addOrUpdateDomainConfig(domain, updateConfig);
    } catch (error) {
      console.error('更新请求头配置失败:', error);
    }
  };

  // 处理对端配置变化
  const handlePeerConfigChange = async (peerKey: string, value: ConfigType) => {
    setPeerConfigs(prevConfigs => 
      prevConfigs.map(config => 
        config.key === peerKey ? { ...config, config: value } : config
      )
    );
    
    // 根据选择的值更新ConfigManager中的配置
    try {
      // 获取当前域名配置
      const domainConfig = await ConfigManager.getDomainConfig(domain) || { domain };
      
      // 准备更新的配置对象
      const updateConfig: Partial<Omit<DomainConfig, 'domain'>> = {
        updateTime: Date.now()
      };
      
      if (value === 'allow') {
        updateConfig.additionalPeers = [
          ...(domainConfig.additionalPeers || []).filter(key => key !== peerKey),
          peerKey
        ];
        updateConfig.disabledPeers = (domainConfig.disabledPeers || []).filter(key => key !== peerKey);
      } else if (value === 'deny') {
        updateConfig.disabledPeers = [
          ...(domainConfig.disabledPeers || []).filter(key => key !== peerKey),
          peerKey
        ];
        updateConfig.additionalPeers = (domainConfig.additionalPeers || []).filter(key => key !== peerKey);
      } else {
        updateConfig.additionalPeers = (domainConfig.additionalPeers || []).filter(key => key !== peerKey);
        updateConfig.disabledPeers = (domainConfig.disabledPeers || []).filter(key => key !== peerKey);
      }
      
      // 更新域名配置
      await ConfigManager.addOrUpdateDomainConfig(domain, updateConfig);
    } catch (error) {
      console.error('更新对端配置失败:', error);
    }
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Tabs>
          <TabPane key="peers" title={
            <Space>
              <span>对端配置</span>
            </Space>
          }>
            {peerConfigs.length > 0 ? (
              <Table
                columns={peerColumns}
                data={peerConfigs}
                size="small"
                border={{ wrapper: true, cell: true }}
                pagination={false}
                scroll={{ y: 200 }}
                loading={loading}
                rowKey="key"
              />
            ) : (
              <Empty description="没有可用的对端" />
            )}
          </TabPane>
          
          <TabPane key="cookies" title={
            <Space>
              <span>Cookie</span>
              <RadioGroup
                type="button"
                size="mini"
                value={sendCookies}
                onChange={handleCookieSyncChange}
              >
                <Radio value="allow">允</Radio>
                <Radio value="deny">禁</Radio>
                <Radio value="default">默</Radio>
              </RadioGroup>
            </Space>
          }>
            <Table
              columns={cookieColumns}
              data={domainData?.cookies || []}
              size="small"
              border={{ wrapper: true, cell: true }}
              pagination={false}
              scroll={{ y: 200 }}
              loading={loading}
              rowKey="name"
            />
          </TabPane>
          
          <TabPane key="headers" title={
            <Space>
              <span>请求头</span>
              <RadioGroup
                type="button"
                size="mini"
                value={sendHeaders}
                onChange={handleHeaderSyncChange}
              >
                <Radio value="allow">允</Radio>
                <Radio value="deny">禁</Radio>
                <Radio value="default">默</Radio>
              </RadioGroup>
            </Space>
          }>
            <Table
              columns={headerColumns}
              data={domainData?.headers || []}
              size="small"
              border={{ wrapper: true, cell: true }}
              pagination={false}
              scroll={{ y: 200 }}
              loading={loading}
              rowKey="key"
            />
          </TabPane>
        </Tabs>
      </Space>
    </div>
  );
};

export default DomainConfigUI;