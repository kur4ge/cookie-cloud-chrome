import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Card, 
  Spin, 
  Typography, 
  Result, 
  Space,
  Select
} from '@arco-design/web-react';
import { IconSettings } from '@arco-design/web-react/icon';
import DomainConfig from './components/DomainConfig';
import './popup.css';

const { Text } = Typography;
const Option = Select.Option;

interface TabData {
  domains: string[];
  cookies: chrome.cookies.Cookie[];
  tabId: number;
}

const Popup = () => {
  const [tabData, setTabData] = useState<TabData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');


  useEffect(() => {
    // 获取当前活动标签页的ID和URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        const currentTabId = tabs[0].id;
        
        // 设置当前URL和默认选中的域名
        if (tabs[0].url) {
          setCurrentUrl(tabs[0].url);
          try {
            const url = new URL(tabs[0].url);
            setSelectedDomain(url.hostname);
          } catch (e) {
            console.error('解析URL失败:', e);
          }
        }
        
        // 获取当前标签页相关的域名和Cookie
        chrome.runtime.sendMessage(
          { type: 'GET_TAB_DOMAINS', tabId: currentTabId },
          (response) => {
            setLoading(false);
            if (response && response.success) {
              setTabData(response.data);
              
              // 如果还没有选择域名，则默认选择第一个
              if (!selectedDomain && response.data.domains.length > 0) {
                setSelectedDomain(response.data.domains[0]);
              }
            } else {
              setError(response?.message || '获取数据失败');
            }
          }
        );
      } else {
        setLoading(false);
        setError('无法获取当前标签页信息');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="popup-container">
      <Card title={
        <Space>
          <IconSettings />
          <span>域名配置</span>
        </Space>
      }>
        {loading ? (
          <div className="loading-container">
            <Spin tip="正在加载数据..." />
          </div>
        ) : error ? (
          <Result
            status="error"
            title="加载失败"
            subTitle={error}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space align="center" style={{ width: '100%' }}>
                <Text bold>选择域名:</Text>
                <Select 
                  style={{ width: '300px' }} 
                  value={selectedDomain || undefined}
                  onChange={setSelectedDomain}
                  placeholder="请选择域名"
                  showSearch
                >
                  {tabData?.domains.map((domain, index) => (
                    <Option key={index} value={domain}>
                      {domain === new URL(currentUrl).hostname ? `${domain} (当前页面)` : domain}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Space>
            
            {selectedDomain && (
              <DomainConfig 
                domain={selectedDomain} 
              />
            )}
          </Space>
        )}
      </Card>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);