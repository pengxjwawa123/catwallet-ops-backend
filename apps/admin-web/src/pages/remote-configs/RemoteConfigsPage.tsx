import { useRef, useState } from 'react';
import { Button, Popconfirm, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { remoteConfigsApi } from '@/api';
import type { RemoteConfig } from '@/utils/types';

export default function RemoteConfigsPage() {
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

  const openEdit = (record: RemoteConfig) => {
    setEditingId(record.id);
    form.setFieldsValue({ key: record.key, value: record.value, description: record.description });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingId) {
        await remoteConfigsApi.update(editingId, values);
      } else {
        await remoteConfigsApi.create(values);
      }
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleDelete = async (id: string) => {
    await remoteConfigsApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<RemoteConfig>[] = [
    { title: t('remoteConfigs.key'), dataIndex: 'key', copyable: true },
    { title: t('remoteConfigs.value'), dataIndex: 'value', ellipsis: true, copyable: true },
    { title: t('remoteConfigs.description'), dataIndex: 'description', ellipsis: true },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 160,
      render: (_, record) => [
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
      <ProTable<RemoteConfig>
        headerTitle={t('remoteConfigs.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('remoteConfigs.createConfig')}
          </Button>,
        ]}
        request={async ({ current = 1, pageSize = 10 }) => {
          const data = await remoteConfigsApi.list({ page: current, pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true }}
      />

      <Modal
        title={editingId ? t('remoteConfigs.editConfig') : t('remoteConfigs.createConfig')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="key" label={t('remoteConfigs.key')} rules={[{ required: !editingId }]}>
            <Input disabled={!!editingId} placeholder="e.g. app.theme.color" />
          </Form.Item>
          <Form.Item name="value" label={t('remoteConfigs.value')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="description" label={t('remoteConfigs.description')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
