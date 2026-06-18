import { useRef, useState } from 'react';
import { Button, Tag, Popconfirm, Modal, Form, Input, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { featureFlagsApi } from '@/api';
import type { FeatureFlag } from '@/utils/types';

export default function FeatureFlagsPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: FeatureFlag) => {
    setEditingId(record.id);
    form.setFieldsValue({
      key: record.key,
      description: record.description,
      payload: record.payload ? JSON.stringify(record.payload, null, 2) : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    let payload: unknown = undefined;
    if (values.payload) {
      try { payload = JSON.parse(values.payload); } catch { payload = values.payload; }
    }
    try {
      if (editingId) {
        await featureFlagsApi.update(editingId, { description: values.description, payload });
      } else {
        await featureFlagsApi.create({ key: values.key, description: values.description, payload });
      }
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleToggle = async (record: FeatureFlag) => {
    const next = record.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    await featureFlagsApi.toggle(record.id, next);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const handleDelete = async (id: string) => {
    await featureFlagsApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<FeatureFlag>[] = [
    { title: t('featureFlags.key'), dataIndex: 'key', copyable: true },
    { title: t('featureFlags.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('featureFlags.status'),
      dataIndex: 'status',
      render: (_, record) => (
        <Tag color={record.status === 'ENABLED' ? 'green' : 'red'}>
          {record.status === 'ENABLED' ? t('featureFlags.enabled') : t('featureFlags.disabled')}
        </Tag>
      ),
    },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      render: (_, record) => [
        <Switch
          key="toggle"
          size="small"
          checked={record.status === 'ENABLED'}
          onChange={() => handleToggle(record)}
        />,
        <Button key="edit" type="link" size="small" onClick={() => openEdit(record)}>
          {t('common.edit')}
        </Button>,
        <Popconfirm
          key="del"
          title={t('common.confirmDelete')}
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" size="small" danger>
            {t('common.delete')}
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<FeatureFlag>
        headerTitle={t('featureFlags.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('featureFlags.createFlag')}
          </Button>,
        ]}
        request={async ({ current = 1, pageSize = 10 }) => {
          const data = await featureFlagsApi.list({ page: current, pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true }}
      />

      <Modal
        title={editingId ? t('featureFlags.editFlag') : t('featureFlags.createFlag')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="key" label={t('featureFlags.key')} rules={[{ required: !editingId }]}>
            <Input disabled={!!editingId} placeholder="e.g. enable_new_feature" />
          </Form.Item>
          <Form.Item name="description" label={t('featureFlags.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="payload" label={t('featureFlags.payload')}>
            <Input.TextArea rows={4} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
