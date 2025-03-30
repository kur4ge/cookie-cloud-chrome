import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Space, Modal, Form, Message, Switch, Tag, Spin, Empty, Radio, AutoComplete, Tabs } from '@arco-design/web-react';
import { IconSearch, IconPlus, IconDelete } from '@arco-design/web-react/icon';
import ConfigManager, { DomainConfig, PeerKeyInfo } from '../../service/config';

const FormItem = Form.Item;
const { TextArea } = Input;
const TabPane = Tabs.TabPane;

const ReportRules = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [domainConfigs, setDomainConfigs] = useState<DomainConfig[]>([]);
  const [filteredConfigs, setFilteredConfigs] = useState<DomainConfig[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('');
  const [headerInputVisible, setHeaderInputVisible] = useState(false);
  const [headerInputType, setHeaderInputType] = useState<'include' | 'exclude'>('include');
  const [headerInputValue, setHeaderInputValue] = useState('');
  const [headerOptions, setHeaderOptions] = useState<string[]>([]);
  const [peerKeys, setPeerKeys] = useState<PeerKeyInfo[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  // 添加一个状态来强制更新UI
  const [peerListVersion, setPeerListVersion] = useState(0);

  // 加载所有域名配置
  const loadDomainConfigs = async () => {
    setLoading(true);
    try {
      const configs = await ConfigManager.getAllDomainConfigs();
      setDomainConfigs(configs);
      setFilteredConfigs(configs);
    } catch (error) {
      console.error('加载域名配置失败:', error);
      Message.error('加载域名配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有对端公钥
  const loadPeerKeys = async () => {
    try {
      const keys = await ConfigManager.getAllPeerKeys();
      setPeerKeys(keys);
    } catch (error) {
      console.error('加载对端公钥失败:', error);
      Message.error('加载对端公钥失败');
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadDomainConfigs();
    loadPeerKeys();
    // 获取所有已知的请求头
    loadHeaderOptions();
  }, []);

  // 加载请求头选项
  const loadHeaderOptions = () => {
    chrome.runtime.sendMessage({ type: 'GET_DOMAIN_DATA', forceAll: true }, (response) => {
      if (response && response.success && response.data) {
        // 从所有域名数据中提取唯一的请求头名称
        const headers = new Set<string>();
        response.data.forEach((domainData: any) => {
          if (domainData.headers) {
            Object.keys(domainData.headers).forEach(header => {
              headers.add(header.toLowerCase());
            });
          }
        });
        setHeaderOptions(Array.from(headers));
      }
    });
  };

  // 搜索过滤
  useEffect(() => {
    if (!searchValue) {
      setFilteredConfigs(domainConfigs);
    } else {
      const filtered = domainConfigs.filter(config => 
        config.domain.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredConfigs(filtered);
    }
  }, [searchValue, domainConfigs]);

  const columns = [
    {
      title: '域名',
      dataIndex: 'domain',
      width: 200,
    },
    {
      title: 'Cookie同步',
      dataIndex: 'enableCookieSync',
      width: 120,
      render: (value: boolean | undefined) => {
        if (value === undefined) {
          return <Tag color="gray">继承全局</Tag>;
        }
        return <Switch checked={value} disabled />;
      },
    },
    {
      title: '请求头同步',
      dataIndex: 'enableHeaderSync',
      width: 120,
      render: (value: boolean | undefined) => {
        if (value === undefined) {
          return <Tag color="gray">继承全局</Tag>;
        }
        return <Switch checked={value} disabled />;
      },
    },
    {
      title: '额外允许的对端',
      dataIndex: 'additionalPeers',
      width: 150,
      render: (peers: string[] = []) => (
        <div style={{ maxWidth: 150, overflow: 'hidden' }}>
          {peers.length > 0 ? (
            <Space wrap>
              {peers.map(publicKey => (
                <Tag key={publicKey} color="green" title={publicKey}>
                  {getPeerFriendlyName(publicKey)}
                </Tag>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#86909c' }}>无</span>
          )}
        </div>
      ),
    },
    {
      title: '额外禁用的对端',
      dataIndex: 'disabledPeers',
      width: 150,
      render: (peers: string[] = []) => (
        <div style={{ maxWidth: 150, overflow: 'hidden' }}>
          {peers.length > 0 ? (
            <Space wrap>
              {peers.map(publicKey => (
                <Tag key={publicKey} color="red" title={publicKey}>
                  {getPeerFriendlyName(publicKey)}
                </Tag>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#86909c' }}>无</span>
          )}
        </div>
      ),
    },
    {
      title: '包含的请求头',
      dataIndex: 'includedHeaders',
      render: (headers: string[] = []) => (
        <div style={{ maxWidth: 300, overflow: 'hidden' }}>
          {headers.length > 0 ? (
            <Space wrap>
              {headers.map(header => (
                <Tag key={header} color="blue">{header}</Tag>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#86909c' }}>继承全局</span>
          )}
        </div>
      ),
    },
    {
      title: '排除的请求头',
      dataIndex: 'excludedHeaders',
      render: (headers: string[] = []) => (
        <div style={{ maxWidth: 300, overflow: 'hidden' }}>
          {headers.length > 0 ? (
            <Space wrap>
              {headers.map(header => (
                <Tag key={header} color="red">{header}</Tag>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#86909c' }}>继承全局</span>
          )}
        </div>
      ),
    },
    {
      title: '最后更新时间',
      dataIndex: 'updateTime',
      width: 180,
      render: (time: number) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: DomainConfig) => (
        <Space>
          <Button type="text" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" status="danger" size="small" onClick={() => handleDelete(record.domain)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 删除域名配置
  const handleDelete = (domain: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除域名 ${domain} 的上报规则吗？`,
      onOk: async () => {
        try {
          const success = await ConfigManager.deleteDomainConfig(domain);
          if (success) {
            Message.success('删除成功');
            loadDomainConfigs();
          } else {
            Message.error('删除失败，未找到指定域名配置');
          }
        } catch (error) {
          console.error('删除域名配置失败:', error);
          Message.error('删除失败');
        }
      },
    });
  };

  // 打开添加对话框
  const handleAdd = () => {
    form.resetFields();
    setIsEditMode(false);
    setCurrentDomain('');
    setVisible(true);
  };

  // 打开编辑对话框
  const handleEdit = (record: DomainConfig) => {
    setCurrentDomain(record.domain);
    form.setFieldsValue({
      domain: record.domain,
      enableCookieSync: record.enableCookieSync === undefined ? 'inherit' : record.enableCookieSync ? 'enable' : 'disable',
      enableHeaderSync: record.enableHeaderSync === undefined ? 'inherit' : record.enableHeaderSync ? 'enable' : 'disable',
      includedHeaders: record.includedHeaders || [],
      excludedHeaders: record.excludedHeaders || [], 
      additionalPeers: record.additionalPeers || [],
      disabledPeers: record.disabledPeers || [],
      notes: record.notes || '',
    });
    setIsEditMode(true);
    setVisible(true);
    setActiveTab('basic');
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      const domain = isEditMode ? currentDomain : values.domain;
      
      // 处理单选框值转换为布尔值或undefined
      const processedValues = {
        ...values,
        enableCookieSync: values.enableCookieSync === 'inherit' ? undefined : values.enableCookieSync === 'enable',
        enableHeaderSync: values.enableHeaderSync === 'inherit' ? undefined : values.enableHeaderSync === 'enable',
        updateTime: Date.now(),
      };
      
      // 创建或更新域名配置
      await ConfigManager.addOrUpdateDomainConfig(domain, processedValues);
      
      Message.success(isEditMode ? '更新成功' : '添加成功');
      setVisible(false);
      form.resetFields();
      loadDomainConfigs();
    } catch (error) {
      console.error('保存域名配置失败:', error);
      Message.error('操作失败');
    }
  };

  // 添加对端公钥到列表
  const handleAddPeer = (type: 'additional' | 'disabled', publicKey: string) => {
    const fieldName = type === 'additional' ? 'additionalPeers' : 'disabledPeers';
    const currentPeers = form.getFieldValue(fieldName) || [];
    
    // 检查是否已存在
    if (!currentPeers.includes(publicKey)) {
      form.setFieldValue(fieldName, [...currentPeers, publicKey]);
      // 增加版本号，强制UI更新
      setPeerListVersion(prev => prev + 1);
    }
  };

  // 从列表中移除对端公钥
  const handleRemovePeer = (type: 'additional' | 'disabled', publicKey: string) => {
    const fieldName = type === 'additional' ? 'additionalPeers' : 'disabledPeers';
    const currentPeers = form.getFieldValue(fieldName) || [];
    form.setFieldValue(
      fieldName,
      currentPeers.filter((p: string) => p !== publicKey)
    );
    // 增加版本号，强制UI更新
    setPeerListVersion(prev => prev + 1);
  };

  // 获取对端公钥的友好名称
  const getPeerFriendlyName = (publicKey: string) => {
    const peer = peerKeys.find(p => p.publicKey === publicKey);
    return peer ? peer.friendlyName : '未知对端';
  };

  // 添加请求头
  const handleAddHeader = () => {
    if (!headerInputValue) return;
    
    const fieldName = headerInputType === 'include' ? 'includedHeaders' : 'excludedHeaders';
    const currentHeaders = form.getFieldValue(fieldName) || [];
    
    // 检查是否已存在
    if (!currentHeaders.includes(headerInputValue)) {
      form.setFieldValue(fieldName, [...currentHeaders, headerInputValue]);
    }
    
    setHeaderInputValue('');
    setHeaderInputVisible(false);
  };

  // 删除请求头
  const handleRemoveHeader = (type: 'include' | 'exclude', header: string) => {
    const fieldName = type === 'include' ? 'includedHeaders' : 'excludedHeaders';
    const currentHeaders = form.getFieldValue(fieldName) || [];
    form.setFieldValue(
      fieldName,
      currentHeaders.filter((h: string) => h !== header)
    );
  };

  return (
    <>
      <Card
        title="域名上报规则管理"
        extra={
          <Space>
            <Input
              placeholder="搜索域名"
              value={searchValue}
              onChange={value => setSearchValue(value)}
              style={{ width: 200 }}
              prefix={<IconSearch />}
              allowClear
            />
            <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
              添加规则
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <Spin tip="加载中..." />
          </div>
        ) : filteredConfigs.length > 0 ? (
          <Table columns={columns} data={filteredConfigs} pagination={{ pageSize: 10 }} />
        ) : (
          <Empty description="暂无域名规则" />
        )}
      </Card>

      <Modal
        title={isEditMode ? "编辑域名上报规则" : "添加域名上报规则"}
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit
        style={{ width: 700 }}
      >
        <Form form={form} onSubmit={handleSubmit} layout="vertical">
          <Tabs activeTab={activeTab} onChange={setActiveTab}>
            <TabPane key="basic" title="基本设置">
              <FormItem
                label="域名"
                field="domain"
                rules={[{ required: true, message: '请输入域名' }]}
                disabled={isEditMode}
              >
                <Input placeholder="请输入域名，例如: example.com" />
              </FormItem>

              <FormItem
                label="Cookie同步"
                field="enableCookieSync"
                tooltip="设置此域名的Cookie同步策略"
                initialValue="inherit"
              >
                <Radio.Group>
                  <Radio value="enable">启用</Radio>
                  <Radio value="disable">禁用</Radio>
                  <Radio value="inherit">继承全局配置</Radio>
                </Radio.Group>
              </FormItem>

              <FormItem
                label="请求头同步"
                field="enableHeaderSync"
                tooltip="设置此域名的请求头同步策略"
                initialValue="inherit"
              >
                <Radio.Group>
                  <Radio value="enable">启用</Radio>
                  <Radio value="disable">禁用</Radio>
                  <Radio value="inherit">继承全局配置</Radio>
                </Radio.Group>
              </FormItem>

              <FormItem
                label="备注"
                field="notes"
              >
                <TextArea placeholder="可选：添加关于此域名规则的备注" />
              </FormItem>
            </TabPane>

            <TabPane key="headers" title="请求头设置">
              <FormItem
                label="包含的请求头"
                field="includedHeaders"
                tooltip="指定需要同步的请求头，如果为空则同步所有非排除的请求头"
              >
                <div>
                  <Space wrap style={{ marginBottom: 8 }}>
                    {(form.getFieldValue('includedHeaders') || []).map((header: string) => (
                      <Tag 
                        key={header} 
                        color="blue" 
                        closable 
                        onClose={() => handleRemoveHeader('include', header)}
                      >
                        {header}
                      </Tag>
                    ))}
                    {!headerInputVisible || headerInputType !== 'include' ? (
                      <Tag 
                        style={{ borderStyle: 'dashed', cursor: 'pointer' }}
                        onClick={() => { setHeaderInputVisible(true); setHeaderInputType('include'); }}
                      >
                        + 添加
                      </Tag>
                    ) : (
                      <AutoComplete
                        style={{ width: 150 }}
                        value={headerInputValue}
                        onChange={setHeaderInputValue}
                        onBlur={handleAddHeader}
                        onPressEnter={handleAddHeader}
                        data={headerOptions.filter(option => 
                          option.includes(headerInputValue.toLowerCase()) && 
                          !(form.getFieldValue('includedHeaders') || []).includes(option)
                        )}
                        placeholder="输入请求头名称"
                      />
                    )}
                  </Space>
                  <div style={{ color: '#86909c', fontSize: 12 }}>
                    如果为空，则同步所有非排除的请求头
                  </div>
                </div>
              </FormItem>

              <FormItem
                label="排除的请求头"
                field="excludedHeaders"
                tooltip="指定不需要同步的请求头"
              >
                <div>
                  <Space wrap style={{ marginBottom: 8 }}>
                    {(form.getFieldValue('excludedHeaders') || []).map((header: string) => (
                      <Tag 
                        key={header} 
                        color="red" 
                        closable 
                        onClose={() => handleRemoveHeader('exclude', header)}
                      >
                        {header}
                      </Tag>
                    ))}
                    {!headerInputVisible || headerInputType !== 'exclude' ? (
                      <Tag 
                        style={{ borderStyle: 'dashed', cursor: 'pointer' }}
                        onClick={() => { setHeaderInputVisible(true); setHeaderInputType('exclude'); }}
                      >
                        + 添加
                      </Tag>
                    ) : (
                      <AutoComplete
                        style={{ width: 150 }}
                        value={headerInputValue}
                        onChange={setHeaderInputValue}
                        onBlur={handleAddHeader}
                        onPressEnter={handleAddHeader}
                        data={headerOptions.filter(option => 
                          option.includes(headerInputValue.toLowerCase()) && 
                          !(form.getFieldValue('excludedHeaders') || []).includes(option)
                        )}
                        placeholder="输入请求头名称"
                      />
                    )}
                  </Space>
                  <div style={{ color: '#86909c', fontSize: 12 }}>
                    常见的敏感请求头如user-agent、referer等建议排除
                  </div>
                </div>
              </FormItem>
            </TabPane>

            <TabPane key="peers" title="对端设置">
              <FormItem
                label="额外允许的对端"
                field="additionalPeers"
                tooltip="指定此域名额外允许的对端，即使它们在全局设置中被禁用"
              >
                <div>
                  {/* 使用peerListVersion作为key的一部分，确保列表更新时重新渲染 */}
                  <Space wrap style={{ marginBottom: 8 }} key={`additional-${peerListVersion}`}>
                    {(form.getFieldValue('additionalPeers') || []).map((publicKey: string) => (
                      <Tag 
                        key={publicKey} 
                        color="green" 
                        closable 
                        onClose={() => handleRemovePeer('additional', publicKey)}
                      >
                        {getPeerFriendlyName(publicKey)}
                      </Tag>
                    ))}
                  </Space>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, color: '#86909c', fontSize: 12 }}>
                      选择要额外允许的对端:
                    </div>
                    {/* 使用peerListVersion作为key的一部分，确保列表更新时重新渲染 */}
                    <Space wrap key={`additional-options-${peerListVersion}`}>
                      {peerKeys.map(peer => {
                        const additionalPeers = form.getFieldValue('additionalPeers') || [];
                        const disabledPeers = form.getFieldValue('disabledPeers') || [];
                        // 如果已经在任一列表中，则不显示
                        if (additionalPeers.includes(peer.publicKey) || disabledPeers.includes(peer.publicKey)) {
                          return null;
                        }
                        return (
                          <Tag 
                            key={peer.publicKey} 
                            color="gray"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleAddPeer('additional', peer.publicKey)}
                          >
                            {peer.friendlyName}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                </div>
              </FormItem>

              <FormItem
                label="额外禁用的对端"
                field="disabledPeers"
                tooltip="指定此域名额外禁用的对端，即使它们在全局设置中被启用"
              >
                <div>
                  {/* 使用peerListVersion作为key的一部分，确保列表更新时重新渲染 */}
                  <Space wrap style={{ marginBottom: 8 }} key={`disabled-${peerListVersion}`}>
                    {(form.getFieldValue('disabledPeers') || []).map((publicKey: string) => (
                      <Tag 
                        key={publicKey} 
                        color="red" 
                        closable 
                        onClose={() => handleRemovePeer('disabled', publicKey)}
                      >
                        {getPeerFriendlyName(publicKey)}
                      </Tag>
                    ))}
                  </Space>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, color: '#86909c', fontSize: 12 }}>
                      选择要额外禁用的对端:
                    </div>
                    {/* 使用peerListVersion作为key的一部分，确保列表更新时重新渲染 */}
                    <Space wrap key={`disabled-options-${peerListVersion}`}>
                      {peerKeys.map(peer => {
                        const additionalPeers = form.getFieldValue('additionalPeers') || [];
                        const disabledPeers = form.getFieldValue('disabledPeers') || [];
                        // 如果已经在任一列表中，则不显示
                        if (additionalPeers.includes(peer.publicKey) || disabledPeers.includes(peer.publicKey)) {
                          return null;
                        }
                        return (
                          <Tag 
                            key={peer.publicKey} 
                            color="gray"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleAddPeer('disabled', peer.publicKey)}
                          >
                            {peer.friendlyName}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                </div>
              </FormItem>
            </TabPane>
          </Tabs>

          <div style={{ marginTop: 24 }}>
            <Space>
              <Button onClick={() => setVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default ReportRules;