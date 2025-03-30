import React, { useState } from 'react';
import { Card, Button, Space, Modal, Message, Divider, Typography } from '@arco-design/web-react';
import { IconDelete } from '@arco-design/web-react/icon';

const { Title, Paragraph } = Typography;

const DataManagement = () => {
  const [clearLoading, setClearLoading] = useState(false);

  // 清除所有数据
  const handleClearAllData = () => {
    Modal.confirm({
      title: '确认清除所有数据',
      content: (
        <Typography>
          <Paragraph>
            此操作将清除所有配置数据，包括：
          </Paragraph>
          <ul>
            <li>服务配置</li>
            <li>私钥和公钥</li>
            <li>所有对端公钥</li>
            <li>域名配置</li>
            <li>历史记录</li>
          </ul>
          <Paragraph style={{ color: '#f00' }}>
            <strong>此操作不可恢复，请确认是否继续？</strong>
          </Paragraph>
        </Typography>
      ),
      okButtonProps: {
        status: 'danger',
      },
      onOk: async () => {
        setClearLoading(true);
        try {
          // 通过消息通知 Service Worker 清除历史上报记录
          await new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage(
              { type: 'CLEAR_ALL_DATA' },
              (response) => {
                if (response && response.success) {
                  resolve();
                } else {
                  reject(new Error(response?.message || '清除历史记录失败'));
                }
              }
            );
          });
          
          Message.success('所有数据已清除');
          // 刷新页面以重新加载默认配置
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (error) {
          console.error('清除数据失败:', error);
          Message.error(error instanceof Error ? error.message : '清除数据失败');
        } finally {
          setClearLoading(false);
        }
      },
    });
  };

  return (
    <Card title="数据管理">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Title heading={6}>危险操作区</Title>
        <Paragraph>
          以下操作可能会导致数据丢失，请谨慎操作。
        </Paragraph>
        
        <Divider />
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title heading={6} style={{ margin: 0 }}>清除所有数据</Title>
              <Paragraph style={{ margin: 0 }}>
                清除所有配置数据，包括服务配置、密钥、对端公钥、域名配置和历史上报记录。
              </Paragraph>
            </div>
            <Button 
              type="primary" 
              status="danger" 
              icon={<IconDelete />} 
              loading={clearLoading}
              onClick={handleClearAllData}
            >
              清除所有数据
            </Button>
          </div>
        </Space>
      </Space>
    </Card>
  );
};

export default DataManagement;