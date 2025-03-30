import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@arco-design/web-react/dist/css/arco.css';
import './options.css';
import { Layout, Menu, Typography, ConfigProvider } from '@arco-design/web-react';
import {
  IconSettings,
  IconLock,
  IconHistory,
  IconTool,
  IconStorage
} from '@arco-design/web-react/icon';

// 导入子页面组件
import ServiceConfig from './components/ServiceConfig';
import PeerKeys from './components/PeerKeys';
import ReportHistory from './components/ReportHistory';
import DataManagement from './components/DataManagement';
import ReportRules from './components/ReportRules';

const { Sider, Content } = Layout;
const MenuItem = Menu.Item;
const { Title } = Typography;

const Options = () => {
  const [selectedKey, setSelectedKey] = useState('1');

  // 根据选中的菜单项渲染对应的内容
  const renderContent = () => {
    switch (selectedKey) {
      case '1':
        return <ServiceConfig />;
      case '2':
        return <PeerKeys />;
      case '3':
        return <ReportHistory />;
      case '4':
        return <ReportRules />;
      case '5':
        return <DataManagement />;
      default:
        return <ServiceConfig />;
    }
  };

  return (
    <ConfigProvider>
      <Layout className="options-layout">
        <Sider width={300} className="options-sider">
          <div className="logo">
            <Title heading={5}>Cookie Cloud</Title>
          </div>
          <Menu
            selectedKeys={[selectedKey]}
            onClickMenuItem={(key) => setSelectedKey(key)}
            style={{ height: 'calc(100% - 100px)', overflow: 'hidden' }}
          >
            <MenuItem key="1">
              <IconSettings /> 服务配置
            </MenuItem>
            <MenuItem key="2">
              <IconLock /> 对端管理
            </MenuItem>
            <MenuItem key="3">
              <IconHistory /> 上报历史
            </MenuItem>
            <MenuItem key="4">
              <IconTool /> 上报规则
            </MenuItem>
            <MenuItem key="5">
              <IconStorage /> 数据管理
            </MenuItem>
          </Menu>
        </Sider>
        <Content className="options-content">
          {renderContent()}
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);