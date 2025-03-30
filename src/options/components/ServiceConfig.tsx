import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Form, Message, Switch, InputNumber, Typography, Space, Modal, Radio } from '@arco-design/web-react';
import ConfigManager, { BaseConfig } from '../../service/config';
import { generateKeyPair, getKeyPairFromPrivateKey } from '../../utils/crypto';

const FormItem = Form.Item;
const { Text } = Typography;
const RadioGroup = Radio.Group;

const ServiceConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [privateKeyModalVisible, setPrivateKeyModalVisible] = useState(false);
  const [keyChangeType, setKeyChangeType] = useState('generate');
  const [inputPrivateKey, setInputPrivateKey] = useState('');
  const [cookieSyncEnabled, setCookieSyncEnabled] = useState(true);
  const [headerSyncEnabled, setHeaderSyncEnabled] = useState(true);

  // 组件加载时获取配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await ConfigManager.getBaseConfig();
        form.setFieldsValue(config);

        setAutoSyncEnabled(config.enableAutoSync);
        setCookieSyncEnabled(config.enableCookieSync);
        setHeaderSyncEnabled(config.enableHeaderSync);

        // 设置最后同步时间
        if (config.lastSyncTime) {
          const date = new Date(config.lastSyncTime);
          setLastSyncTime(date.toLocaleString('zh-CN'));
        }

        // 如果自动同步开启，获取下次同步时间
        if (config.enableAutoSync) {
          const nextTime = await ConfigManager.getNextSyncTime();
          const nextDate = new Date(nextTime);
          setNextSyncTime(nextDate.toLocaleString('zh-CN'));
        }

        // 获取公钥
        const pubKey = await ConfigManager.getPublicKey();
        setPublicKey(pubKey);
      } catch (error) {
        Message.error('获取配置失败');
        console.error('获取配置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [form]);

  // 处理主动同步
  const handleForceSyncClick = async () => {
    try {
      setSyncLoading(true);
      
      // 向 worker 发送强制同步消息
      const result = await chrome.runtime.sendMessage({
        type: 'FORCE_SYNC'
      });
      
      if (result && result.success) {
        Message.success('强制同步成功');
        
        // 更新最后同步时间显示
        const config = await ConfigManager.getBaseConfig();
        if (config.lastSyncTime) {
          const date = new Date(config.lastSyncTime);
          setLastSyncTime(date.toLocaleString('zh-CN'));
        }
        
        // 如果自动同步开启，更新下次同步时间
        if (autoSyncEnabled) {
          const nextTime = await ConfigManager.getNextSyncTime();
          const nextDate = new Date(nextTime);
          setNextSyncTime(nextDate.toLocaleString('zh-CN'));
        }
      } else {
        Message.error(`同步失败: ${result?.message || '未知错误'}`);
      }
    } catch (error) {
      Message.error('同步请求失败');
      console.error('同步请求失败:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  // 处理正常同步
  const handleNormalSyncClick = async () => {
    try {
      setSyncLoading(true);
      
      // 向 worker 发送正常同步消息
      const result = await chrome.runtime.sendMessage({
        type: 'NORMAL_SYNC'
      });
      
      if (result && result.success) {
        Message.success('同步成功');
        
        // 更新最后同步时间显示
        const config = await ConfigManager.getBaseConfig();
        if (config.lastSyncTime) {
          const date = new Date(config.lastSyncTime);
          setLastSyncTime(date.toLocaleString('zh-CN'));
        }
        
        // 如果自动同步开启，更新下次同步时间
        if (autoSyncEnabled) {
          const nextTime = await ConfigManager.getNextSyncTime();
          const nextDate = new Date(nextTime);
          setNextSyncTime(nextDate.toLocaleString('zh-CN'));
        }
      } else {
        Message.error(`同步失败: ${result?.message || '未知错误'}`);
      }
    } catch (error) {
      Message.error('同步请求失败');
      console.error('同步请求失败:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  // 处理Cookie同步开关变化
  const handleCookieSyncChange = async (checked: boolean) => {
    setCookieSyncEnabled(checked);
    try {
      setLoading(true);
      // 获取当前配置并更新
      const currentConfig = await ConfigManager.getBaseConfig();
      await ConfigManager.saveBaseConfig({
        ...currentConfig,
        enableCookieSync: checked
      });
      Message.success('全局Cookie同步设置已更新');
    } catch (error) {
      Message.error('更新全局Cookie同步设置失败');
      console.error('更新全局Cookie同步设置失败:', error);
      // 恢复状态
      setCookieSyncEnabled(!checked);
    } finally {
      setLoading(false);
    }
  };

  // 处理Header同步开关变化
  const handleHeaderSyncChange = async (checked: boolean) => {
    setHeaderSyncEnabled(checked);
    try {
      setLoading(true);
      // 获取当前配置并更新
      const currentConfig = await ConfigManager.getBaseConfig();
      await ConfigManager.saveBaseConfig({
        ...currentConfig,
        enableHeaderSync: checked
      });
      Message.success('全局Header同步设置已更新');
    } catch (error) {
      Message.error('更新全局Header同步设置失败');
      console.error('更新全局Header同步设置失败:', error);
      // 恢复状态
      setHeaderSyncEnabled(!checked);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: BaseConfig) => {
    try {
      setLoading(true);
      // 保留原来的 lastSyncTime 和同步设置
      const currentConfig = await ConfigManager.getBaseConfig();
      const newConfig = {
        ...values,
        privateKey: currentConfig.privateKey, // 保持原有 privateKey 的值，不进行更新
        lastSyncTime: currentConfig.lastSyncTime,
        enableCookieSync: cookieSyncEnabled, // 使用当前状态的值
        enableHeaderSync: headerSyncEnabled  // 使用当前状态的值
      };
      await ConfigManager.saveBaseConfig(newConfig);

      // 更新自动同步状态
      setAutoSyncEnabled(values.enableAutoSync);

      // 如果自动同步开启，重新计算下次同步时间
      if (values.enableAutoSync) {
        const nextTime = await ConfigManager.getNextSyncTime();
        const nextDate = new Date(nextTime);
        setNextSyncTime(nextDate.toLocaleString('zh-CN'));
      } else {
        setNextSyncTime(null);
      }

      Message.success('服务配置已保存');
    } catch (error) {
      Message.error('保存配置失败');
      console.error('保存配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理自动同步开关变化
  const handleAutoSyncChange = async (checked: boolean) => {
    setAutoSyncEnabled(checked);
    if (checked) {
      try {
        const nextTime = await ConfigManager.getNextSyncTime();
        const nextDate = new Date(nextTime);
        setNextSyncTime(nextDate.toLocaleString('zh-CN'));
      } catch (error) {
        console.error('获取下次同步时间失败:', error);
      }
    } else {
      setNextSyncTime(null);
    }
  };

  // 复制私钥到剪贴板
  const handleCopyPrivateKey = async () => {
    try {
      const privateKey = await ConfigManager.getPrivateKey();
      if (privateKey) {
        await navigator.clipboard.writeText('0x' + privateKey);
        Message.success('私钥已复制到剪贴板');
      } else {
        Message.error('未找到私钥');
      }
    } catch (error) {
      Message.error('复制私钥失败');
      console.error('复制私钥失败:', error);
    }
  };

  // 打开更换私钥对话框
  const handleChangePrivateKey = () => {
    setPrivateKeyModalVisible(true);
    setKeyChangeType('generate');
    setInputPrivateKey('');
  };

  // 确认更换私钥
  const handleConfirmKeyChange = async () => {
    try {
      setLoading(true);
      let newPrivateKey: string;
      let newPublicKey: string;

      if (keyChangeType === 'generate') {
        // 生成新的密钥对
        const keyPair = generateKeyPair();
        newPrivateKey = keyPair.privateKey;
        newPublicKey = keyPair.publicKey;
      } else {
        // 使用输入的私钥
        if (!inputPrivateKey.trim()) {
          Message.error('请输入有效的私钥');
          setLoading(false);
          return;
        }

        try {
          const keyPair = getKeyPairFromPrivateKey(inputPrivateKey.trim());
          newPrivateKey = keyPair.privateKey;
          newPublicKey = keyPair.publicKey;
        } catch (error) {
          Message.error('无效的私钥格式');
          console.error('私钥格式错误:', error);
          setLoading(false);
          return;
        }
      }
      // 更新配置中的私钥
      const currentConfig = await ConfigManager.getBaseConfig();
      const newConfig = {
        ...currentConfig,
        privateKey: newPrivateKey
      };
      await ConfigManager.saveBaseConfig(newConfig);

      // 更新公钥显示
      setPublicKey(newPublicKey);

      Message.success('密钥已更新');
      setPrivateKeyModalVisible(false);
    } catch (error) {
      Message.error('更新密钥失败');
      console.error('更新密钥失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="服务配置">
      <Form
        form={form}
        autoComplete="off"
        onSubmit={handleSubmit}
        layout="vertical"
        disabled={loading}
      >
        <FormItem
          label="浏览器名称（注意这个会加入索引计算，乱动会丢数据）"
          field="serviceName"
          rules={[{ required: true, message: '请输入浏览器名称' }]}
        >
          <Input placeholder="请输入服务昵称" style={{ maxWidth: '50%' }} />
        </FormItem>

        <FormItem label="公钥（注意这个会加入索引计算，乱动会丢数据）"
          rules={[{ required: true, message: '请配置密钥' }]}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Text copyable>
              {publicKey ? ('0x' + publicKey) : '未设置公钥'}
            </Text>
            <Space>
              <Button size="small" type="secondary" onClick={handleCopyPrivateKey}>
                复制私钥
              </Button>
              <Button size="small" type="primary" onClick={handleChangePrivateKey}>
                {publicKey ? '更换密钥' : '新增密钥'}
              </Button>
            </Space>
          </div>
        </FormItem>

        <FormItem
          label="上报接口地址"
          field="endpoint"
          rules={[{ required: true, message: '请输入上报接口地址' }]}
        >
          <Input placeholder="请输入上报数据的接口地址" style={{ maxWidth: '50%' }} />
        </FormItem>
        
        <FormItem
          label="同步间隔(分钟)"
          field="syncInterval"
          rules={[{ required: true, message: '请输入同步间隔' }]}
        >
          <InputNumber min={1} max={1440} defaultValue={5} style={{ maxWidth: '50%' }} />
        </FormItem>

        {/* 全局同步控制 */}
        <FormItem label="全局同步控制" style={{ maxWidth: '50%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Cookie 同步</Text>
                <Switch 
                  checked={cookieSyncEnabled} 
                  onChange={handleCookieSyncChange}
                  disabled={loading}
                />
              </div>
            </div>
            <div style={{ flex: 1, paddingRight: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Header 同步</Text>
                <Switch 
                  checked={headerSyncEnabled} 
                  onChange={handleHeaderSyncChange}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </FormItem>

        <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '50%' }}>
          <FormItem
            label="自动同步"
            field="enableAutoSync"
            triggerPropName="checked"
            style={{ flex: 1 }}
          >
            <Switch onChange={handleAutoSyncChange} />
          </FormItem>

          {autoSyncEnabled && nextSyncTime ? (
            <FormItem label="下次同步时间" style={{ flex: 1 }}>
              <Text>{nextSyncTime}</Text>
            </FormItem>
          ) : (
            <div style={{ flex: 1 }}></div>
          )}
        </div>

        <FormItem label="最后同步时间">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Text>{lastSyncTime ? lastSyncTime : "还没同步过哦"}</Text>
            <Space>
              <Button 
                type="primary" 
                size="small" 
                loading={syncLoading}
                onClick={handleNormalSyncClick}
              >
                同步
              </Button>
              <Button 
                type="primary" 
                status="warning" 
                size="small" 
                loading={syncLoading}
                onClick={handleForceSyncClick}
              >
                强制同步
              </Button>
            </Space>
          </div>
        </FormItem>

        <FormItem>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存配置
          </Button>
        </FormItem>
      </Form>

      {/* 更换私钥对话框 */}
      <Modal
        title="更换密钥"
        visible={privateKeyModalVisible}
        onOk={handleConfirmKeyChange}
        onCancel={() => setPrivateKeyModalVisible(false)}
        confirmLoading={loading}
      >
        <RadioGroup
          value={keyChangeType}
          onChange={setKeyChangeType}
          style={{ marginBottom: '16px' }}
        >
          <Radio value="generate">生成新的密钥对</Radio>
          <Radio value="import">导入已有私钥</Radio>
        </RadioGroup>

        {keyChangeType === 'import' && (
          <Input.TextArea
            placeholder="请输入私钥"
            value={inputPrivateKey}
            onChange={setInputPrivateKey}
            rows={4}
          />
        )}

        <div style={{ marginTop: '16px' }}>
          <Text type="warning">
            注意：更换私钥后，之前的加密数据将无法解密，请确保已备份重要数据。
          </Text>
        </div>
      </Modal>
    </Card>
  );
};

export default ServiceConfig;