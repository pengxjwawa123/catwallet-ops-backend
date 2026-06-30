import { useRef, useState } from 'react';
import { Button, Popconfirm, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { permissionsApi } from '@/api';
import type { Permission } from '@/utils/types';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/utils/permissions';
import { permLabel, permDescription } from '@/utils/permissionLabels';

export default function PermissionsPage() {
  const { t } = useTranslation();
  const { superAdmin, hasPermission } = useAuth();
  const canManage = superAdmin || hasPermission(PERMISSIONS.rbac.manage);
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await permissionsApi.create(values);
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleDelete = async (id: string) => {
    await permissionsApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<Permission>[] = [
    {
      title: t('rbac.permissionName'),
      dataIndex: 'name',
      copyable: true,
      render: (_, record) => `${record.resource}:${record.action}`,
    },
    {
      title: t('rbac.permissionLabel', '名称'),
      render: (_, record) => permLabel(t, `${record.resource}:${record.action}`),
    },
    {
      title: t('rbac.description'),
      dataIndex: 'description',
      ellipsis: true,
      render: (_, record) => permDescription(t, `${record.resource}:${record.action}`) || '-',
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, record) => [
        ...(canManage ? [
          <Popconfirm
            key="del"
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              {t('common.delete')}
            </Button>
          </Popconfirm>,
        ] : []),
      ],
    },
  ];

  return (
    <>
      <ProTable<Permission>
        headerTitle={t('rbac.permissionsTitle')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => canManage ? [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
            {t('rbac.createPermission')}
          </Button>,
        ] : []}
        request={async () => {
          const data = await permissionsApi.list();
          const items = Array.isArray(data) ? data : [];
          return { data: items, total: items.length, success: true };
        }}
        columns={columns}
        pagination={false}
      />

      <Modal
        title={t('rbac.createPermission')}
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('rbac.permissionName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. ops_user:read" />
          </Form.Item>
          <Form.Item name="description" label={t('rbac.description')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
