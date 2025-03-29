import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Space, Modal, Form, Message, Switch, Tooltip, Radio } from '@arco-design/web-react';
import { IconQuestionCircle, IconCopy } from '@arco-design/web-react/icon';
import ConfigManager, { PeerKeyInfo } from '../../service/config';
import { generateKeyPair } from '../../utils/crypto';

const FormItem = Form.Item;
const { TextArea } = Input;
const RadioGroup = Radio.Group;

const PeerKeys = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [peerKeys, setPeerKeys] = useState<PeerKeyInfo[]>([]);
  const [keyMode, setKeyMode] = useState<'input' | 'generate'>('input');
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false); // 添加编辑模式状态

  // 加载所有对端公钥
  const loadPeerKeys = async () => {
    setLoading(true);
    try {
      const keys = await ConfigManager.getAllPeerKeys();
      setPeerKeys(keys);
    } catch (error) {
      console.error('加载对端公钥失败:', error);
      Message.error('加载对端公钥失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadPeerKeys();
  }, []);

  const columns = [
    {
      title: '友好名称',
      dataIndex: 'friendlyName',
    },
    {
      title: '公钥',
      dataIndex: 'publicKey',
      render: (text: string) => '0x' + text,
    },
    {
      title: '添加时间',
      dataIndex: 'addedTime',
      render: (time: number) => new Date(time).toLocaleString(),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      render: (text: string) => text || '-',
    },
    {
      title: (
        <Space>
          <span>全局启用</span>
          <Tooltip content="启用后，所有信息都会共享给TA">
            <IconQuestionCircle />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'globalEnabled',
      render: (enabled: boolean, record: PeerKeyInfo) => (
        <Switch
          checked={record.disabled ? false : enabled}
          disabled={!!record.disabled}
          onChange={(checked) => handleToggleEnabled(record.publicKey, checked)}
        />
      ),
    },
    {
      title: (
        <Space>
          <span>禁用状态</span>
          <Tooltip content="禁用后，此对端将无法接收任何数据">
            <IconQuestionCircle />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'disabled',
      render: (disabled: boolean, record: PeerKeyInfo) => (
        <Switch
          checked={!!disabled}
          onChange={(checked) => handleToggleDisabled(record.publicKey, checked)}
        />
      ),
    },
    {
      title: '操作',
      render: (_: any, record: PeerKeyInfo) => (
        <Space>
          <Button type="text" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" status="danger" size="small" onClick={() => handleDelete(record.publicKey)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 切换禁用状态
  const handleToggleDisabled = async (publicKey: string, disabled: boolean) => {
    // 处理可能带有0x前缀的公钥
    let normalizedPublicKey = publicKey;
    if (normalizedPublicKey.toLowerCase().startsWith('0x')) {
      normalizedPublicKey = normalizedPublicKey.slice(2);
    }

    try {
      // 如果启用禁用状态，则同时关闭全局启用
      if (disabled) {
        await ConfigManager.updatePeerKey(normalizedPublicKey, {
          disabled: true,
          globalEnabled: false
        });
      } else {
        await ConfigManager.updatePeerKey(normalizedPublicKey, { disabled });
      }

      Message.success(`${disabled ? '禁用开启' : '禁用关闭'}成功`);
      loadPeerKeys(); // 重新加载数据
    } catch (error) {
      console.error('更新禁用状态失败:', error);
      Message.error('操作失败');
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      // 处理公钥，去除可能存在的0x前缀
      let normalizedPublicKey = values.publicKey;
      if (normalizedPublicKey.toLowerCase().startsWith('0x')) {
        normalizedPublicKey = normalizedPublicKey.slice(2);
      }

      // 如果禁用状态为true，则强制将全局启用设为false
      if (values.disabled) {
        values.globalEnabled = false;
      }

      // 检查是否为编辑现有公钥
      const existingKey = peerKeys.find(key => {
        // 比较时也需要处理可能存在的0x前缀
        const normalizedExistingKey = key.publicKey.toLowerCase().startsWith('0x')
          ? key.publicKey.slice(2)
          : key.publicKey;
        return normalizedExistingKey === normalizedPublicKey || key.publicKey === values.publicKey;
      });

      if (existingKey) {
        // 更新现有公钥
        await ConfigManager.updatePeerKey(existingKey.publicKey, {
          friendlyName: values.friendlyName,
          notes: values.notes,
          globalEnabled: values.globalEnabled,
          disabled: values.disabled
        });
        Message.success('更新成功');
      } else {
        // 添加新公钥，使用处理后的公钥
        await ConfigManager.addPeerKey({
          publicKey: normalizedPublicKey,
          friendlyName: values.friendlyName,
          notes: values.notes,
          globalEnabled: values.globalEnabled,
          disabled: values.disabled
        });
        Message.success('添加成功');
      }

      setVisible(false);
      form.resetFields();
      loadPeerKeys(); // 重新加载数据
    } catch (error) {
      console.error('保存公钥失败:', error);
      Message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (publicKey: string, enabled: boolean) => {
    // 处理可能带有0x前缀的公钥
    let normalizedPublicKey = publicKey;
    if (normalizedPublicKey.toLowerCase().startsWith('0x')) {
      normalizedPublicKey = normalizedPublicKey.slice(2);
    }

    try {
      await ConfigManager.updatePeerKey(normalizedPublicKey, { globalEnabled: enabled });
      Message.success(`${enabled ? '启用' : '禁用'}成功`);
      loadPeerKeys(); // 重新加载数据
    } catch (error) {
      console.error('更新状态失败:', error);
      Message.error('操作失败');
    }
  };

  // 删除公钥
  const handleDelete = (publicKey: string) => {
    // 处理可能带有0x前缀的公钥
    let normalizedPublicKey = publicKey;
    if (normalizedPublicKey.toLowerCase().startsWith('0x')) {
      normalizedPublicKey = normalizedPublicKey.slice(2);
    }
    debugger
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个对端公钥吗？',
      onOk: async () => {
        try {
          const success = await ConfigManager.deletePeerKey(normalizedPublicKey);
          if (success) {
            Message.success('删除成功');
            loadPeerKeys(); // 重新加载数据
          } else {
            Message.error('删除失败，未找到指定公钥');
          }
        } catch (error) {
          console.error('删除公钥失败:', error);
          Message.error('删除失败');
        }
      },
    });
  };

  // 打开添加对话框
  const handleAdd = () => {
    form.resetFields();
    setKeyMode('input');
    setGeneratedKeyPair(null);
    setIsEditMode(false); // 设置为添加模式
    setVisible(true);
  };

  // 打开编辑对话框
  const handleEdit = (record: PeerKeyInfo) => {
    form.setFieldsValue({
      friendlyName: record.friendlyName,
      publicKey: '0x' + record.publicKey,
      notes: record.notes || '',
      globalEnabled: record.globalEnabled,
      disabled: record.disabled
    });
    setIsEditMode(true); // 设置为编辑模式
    setVisible(true);
  };

  // 生成新的密钥对
  const handleGenerateKeyPair = async () => {
    try {
      const keyPair = await generateKeyPair();
      setGeneratedKeyPair(keyPair);
      form.setFieldValue('publicKey', '0x' + keyPair.publicKey);
    } catch (error) {
      console.error('生成密钥对失败:', error);
      Message.error('生成密钥对失败');
    }
  };

  // 复制私钥到剪贴板
  const copyPrivateKeyToClipboard = () => {
    if (generatedKeyPair?.privateKey) {
      navigator.clipboard.writeText('0x' + generatedKeyPair.privateKey)
        .then(() => {
          Message.success('私钥已复制到剪贴板');
        })
        .catch((error) => {
          console.error('复制失败:', error);
          Message.error('复制失败');
        });
    }
  };


  return (
    <>
      <Card
        title="对端公钥管理"
        extra={<Button type="primary" onClick={handleAdd}>添加对端</Button>}
        loading={loading}
      >
        <Table columns={columns} data={peerKeys} loading={loading} />
      </Card>

      <Modal
        title={isEditMode ? "编辑对端公钥" : "添加对端公钥"}
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit
      >
        <Form form={form} onSubmit={handleSubmit} layout="vertical">
          <FormItem
            label="友好名称"
            field="friendlyName"
            rules={[{ required: true, message: '请输入友好名称' }]}
          >
            <Input placeholder="请输入友好名称" />
          </FormItem>

          {/* 仅在非编辑模式下显示密钥获取方式 */}
          {!isEditMode && (
            <FormItem label="密钥获取方式">
              <RadioGroup
                value={keyMode}
                onChange={setKeyMode}
                options={[
                  { label: '手动输入', value: 'input' },
                  { label: '生成新密钥对', value: 'generate' }
                ]}
              />
            </FormItem>
          )}

          {/* 仅在非编辑模式且选择生成密钥对时显示 */}
          {!isEditMode && keyMode === 'generate' && (
            <FormItem>
              <Button type="primary" onClick={handleGenerateKeyPair}>
                {generatedKeyPair ? '重新生成' : '生成密钥对'}
              </Button>
            </FormItem>
          )}

          {/* 仅在非编辑模式且已生成密钥对时显示 */}
          {!isEditMode && keyMode === 'generate' && generatedKeyPair && (
            <FormItem label="私钥 (请妥善保存)">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.Password
                  value={generatedKeyPair?.privateKey ? ('0x' + generatedKeyPair.privateKey) : ''}
                  readOnly
                  addAfter={
                    <Button
                      type="text"
                      icon={<IconCopy />}
                      onClick={copyPrivateKeyToClipboard}
                    />
                  }
                />
                <div style={{ color: '#f00', fontSize: '12px' }}>
                  请立即复制并安全保存私钥，关闭此窗口后将无法再次查看！
                </div>
              </Space>
            </FormItem>
          )}

          <FormItem
            label="公钥"
            field="publicKey"
            rules={[{ required: true, message: '请输入公钥' }]}
            extra={isEditMode ? "公钥不可修改" : (keyMode === 'input' ? "添加后公钥不可修改" : "已自动填入生成的公钥")}
          >
            <TextArea
              placeholder="请输入公钥"
              rows={3}
              readOnly={isEditMode || keyMode === 'generate'} // 编辑模式或生成密钥对模式下禁止修改
            />
          </FormItem>

          <FormItem
            label="备注"
            field="notes"
          >
            <TextArea placeholder="可选备注信息" rows={2} />
          </FormItem>

          <FormItem
            label="全局启用"
            field="globalEnabled"
            shouldUpdate={(prevValues, currentValues) => prevValues.disabled !== currentValues.disabled}
          >
            {() => {
              const disabled = form.getFieldValue('disabled');
              return (
                <Switch
                  disabled={disabled}
                  checked={disabled ? false : form.getFieldValue('globalEnabled')}
                />
              );
            }}
          </FormItem>

          <FormItem
            label="禁用状态"
            field="disabled"
            extra="禁用后，此对端将无法接收任何数据"
            shouldUpdate={(prevValues, currentValues) => prevValues.disabled !== currentValues.disabled}
          >
            {() => {
              const disabled = form.getFieldValue('disabled');
              return (
                <Switch
                  onChange={(checked) => {
                    if (checked) {
                      // 如果启用禁用状态，则自动关闭全局启用
                      form.setFieldValue('globalEnabled', false);
                    }
                  }}
                  checked={disabled}
                />
              );
            }
            }
          </FormItem>
          <Space>
            <Button onClick={() => setVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              确定
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default PeerKeys;