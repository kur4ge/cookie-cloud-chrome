import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Space, DatePicker, Input, Select, Form, Message, Pagination, Tag } from '@arco-design/web-react';
import { IconRefresh, IconDelete } from '@arco-design/web-react/icon';
import { SyncReport, ReportQueryOptions } from '../../service/reportHistory';
import ConfigManager from '../../service/config';

const FormItem = Form.Item;
const { RangePicker } = DatePicker;
const Option = Select.Option;

const ReportHistory = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<SyncReport[]>([]);
  const [total, setTotal] = useState(0);
  const [peerKeyInfoMap, setPeerKeyInfoMap] = useState<Record<string, string>>({});
  const [allPeerKeys, setAllPeerKeys] = useState<string[]>([]);
  const [queryParams, setQueryParams] = useState<ReportQueryOptions>({
    limit: 10,
    offset: 0
  });

  // 加载所有对端公钥信息
  const loadPeerKeyInfos = async () => {
    try {
      const peerKeys = await ConfigManager.getAllPeerKeys();
      const keyMap: Record<string, string> = {};
      
      peerKeys.forEach(key => {
        keyMap[key.publicKey] = key.friendlyName;
      });
      
      setPeerKeyInfoMap(keyMap);
    } catch (error) {
      console.error('加载对端公钥信息失败:', error);
    }
  };

  // 加载所有历史上报中的对端公钥
  const loadAllHistoryPeerKeys = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_PEER_KEYS'
      });

      if (response.success) {
        setAllPeerKeys(response.keys);
      } else {
        console.error('获取历史对端公钥失败:', response.message);
      }
    } catch (error) {
      console.error('获取历史对端公钥失败:', error);
    }
  };

  // 加载上报记录
  const loadReports = async (params: ReportQueryOptions = queryParams) => {
    setLoading(true);
    try {
      // 发送消息到后台获取数据
      const response = await chrome.runtime.sendMessage({
        type: 'QUERY_REPORTS',
        options: params
      });

      if (response.success) {
        setReports(response.data);
      } else {
        Message.error(response.message || '查询上报记录失败');
      }

      // 获取总记录数（传递相同的筛选条件）
      const countResponse = await chrome.runtime.sendMessage({
        type: 'GET_REPORT_COUNT',
        options: params
      });

      if (countResponse.success) {
        setTotal(countResponse.count);
      }
    } catch (error) {
      console.error('加载上报记录失败:', error);
      Message.error('加载上报记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadPeerKeyInfos();
    loadAllHistoryPeerKeys();
    loadReports();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '上报时间',
      dataIndex: 'timestamp',
      render: (time: number) => new Date(time).toLocaleString(),
      sorter: (a: SyncReport, b: SyncReport) => a.timestamp - b.timestamp,
    },
    {
      title: '域名',
      dataIndex: 'domain',
    },
    {
      title: '数据标识',
      dataIndex: 'dataIdentifier',
      render: (id: string) => {
        if (!id) return '-';
        const shortId = `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
        return (
          <Tag 
            color="arcoblue" 
            title={id}
            onDoubleClick={() => {
              navigator.clipboard.writeText(id)
                .then(() => {
                  Message.success('数据标识已复制到剪贴板');
                })
                .catch(err => {
                  console.error('复制失败:', err);
                  Message.error('复制失败');
                });
            }}
            style={{ cursor: 'pointer' }}
          >
            {shortId}
          </Tag>
        );
      },
    },
    {
      title: 'Cookie条数',
      dataIndex: 'cookieCount',
    },
    {
      title: 'Header条数',
      dataIndex: 'headerCount',
    },
    {
      title: '对端公钥',
      dataIndex: 'sharedWithKeys',
      render: (keys: string[]) => {
        if (!keys || keys.length === 0) return '-';
        
        return (
          <Space wrap>
            {keys.map(key => {
              const friendlyName = peerKeyInfoMap[key] || `0x${key.substring(0, 16)}...`;
              const color = peerKeyInfoMap[key] ? 'blue' : 'gray';
              
              return (
                <Tag 
                  key={key} 
                  color={color}
                  title={`0x${key}`}
                  onDoubleClick={() => {
                    navigator.clipboard.writeText(`0x${key}`)
                      .then(() => {
                        Message.success('公钥已复制到剪贴板');
                      })
                      .catch(err => {
                        console.error('复制失败:', err);
                        Message.error('复制失败');
                      });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {friendlyName}
                </Tag>
              );
            })}
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'success',
      render: (success: boolean) => (
        <span style={{ color: success ? '#00b42a' : '#f53f3f' }}>
          {success ? '成功' : '失败'}
        </span>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      render: (text: string) => text || '-',
    },
  ];

  // 处理查询
  const handleSearch = () => {
    const values = form.getFieldsValue();
    const params: ReportQueryOptions = {
      limit: queryParams.limit,
      offset: 0, // 重置到第一页
    };

    // 处理时间范围
    if (values.timeRange && values.timeRange.length === 2) {
      params.startTime = values.timeRange[0].valueOf();
      params.endTime = values.timeRange[1].valueOf();
    }

    // 处理域名
    if (values.domain) {
      params.domain = values.domain;
    }

    // 处理状态
    if (values.success !== undefined) {
      params.success = values.success === 'true';
    }

    // 处理对端公钥筛选
    if (values.publicKey) {
      params.publicKey = values.publicKey;
    }

    setQueryParams(params);
    loadReports(params);
  };

  // 处理重置
  const handleReset = () => {
    form.resetFields();
    const params: ReportQueryOptions = {
      limit: 10,
      offset: 0
    };
    setQueryParams(params);
    loadReports(params);
  };

  // 渲染公钥选项
  const renderPeerKeyOptions = () => {
    return allPeerKeys.map(key => {
      const displayName = peerKeyInfoMap[key] 
        ? `${peerKeyInfoMap[key]} (0x${key.substring(0, 8)}...)`
        : `0x${key.substring(0, 16)}...`;
      
      return (
        <Option key={key} value={key}>
          {displayName}
        </Option>
      );
    });
  };

  // 处理分页
  const handlePageChange = (page: number, pageSize: number = queryParams.limit!) => {
    const params = {
      ...queryParams,
      limit: pageSize,
      offset: (page - 1) * pageSize
    };
    setQueryParams(params);
    loadReports(params);
  };

  // 处理每页条数变化
  const handlePageSizeChange = (pageSize: number) => {
    const params = {
      ...queryParams,
      limit: pageSize,
      offset: 0 // 切换每页条数时重置到第一页
    };
    setQueryParams(params);
    loadReports(params);
  };

  // 清空所有记录
  const handleClearAll = () => {
    if (window.confirm('确定要清空所有上报记录吗？此操作不可恢复！')) {
      setLoading(true);
      chrome.runtime.sendMessage({ type: 'CLEAR_REPORTS' })
        .then(response => {
          if (response.success) {
            Message.success('清空记录成功');
            loadReports({ limit: 10, offset: 0 });
          } else {
            Message.error(response.message || '清空记录失败');
          }
        })
        .catch(error => {
          console.error('清空记录失败:', error);
          Message.error('清空记录失败');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  return (
    <Card
      title="上报记录查询"
      extra={
        <Space>
          <Button
            type="primary"
            icon={<IconRefresh />}
            onClick={() => {
              loadPeerKeyInfos();
              loadAllHistoryPeerKeys();
              loadReports(queryParams);
            }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={handleClearAll}
          >
            清空记录
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
        onSubmit={handleSearch}
      >
        <FormItem label="时间范围" field="timeRange">
          <RangePicker showTime />
        </FormItem>
        <FormItem label="域名" field="domain">
          <Input placeholder="请输入域名" style={{ width: 200 }} />
        </FormItem>
        <FormItem label="对端公钥" field="publicKey">
          <Select placeholder="请选择对端公钥" style={{ width: 220 }} allowClear>
            {renderPeerKeyOptions()}
          </Select>
        </FormItem>
        <FormItem label="状态" field="success">
          <Select placeholder="请选择状态" style={{ width: 120 }}>
            <Option value="">全部</Option>
            <Option value="true">成功</Option>
            <Option value="false">失败</Option>
          </Select>
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </FormItem>
      </Form>

      <Table
        columns={columns}
        data={reports}
        loading={loading}
        pagination={false}
        rowKey="id"
      />

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Pagination
          total={total}
          current={Math.floor(queryParams.offset! / queryParams.limit!) + 1}
          pageSize={queryParams.limit}
          onChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showTotal
          sizeCanChange
          sizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </Card>
  );
};

export default ReportHistory;