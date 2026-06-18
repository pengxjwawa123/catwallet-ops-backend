import { useRef, useState } from 'react';
import { Button, Tag, Popconfirm, Modal, Form, Input, Checkbox, message, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { rolesApi, permissionsApi } from '@/api';
import type { Role, Permission } from '@/utils/types';

const { Text } = Typography;

export default function RolesPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [permForm] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);

  const loadPerms = async () => {
    try {
      const data = await permissionsApi.list();
      setAllPerms(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Role) => {
    setEditingId(record.id);
    form.setFieldsValue({ name: record.name, description: record.description });
    setModalOpen(true);
  };

  const openAssignPerms = async (record: Role) => {
    setAssigningRole(record);
    await loadPerms();
    const currentIds = record.permissions?.map((p) => p.id) ?? [];
    permForm.setFieldsValue({ permissionIds: currentIds });
    setPermModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingId) {
        await rolesApi.update(editingId, { description: values.description });
      } else {
        await rolesApi.create(values);
      }
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleAssignPerms = async () => {
    if (!assigningRole) return;
    const values = await permForm.validateFields();
    try {
      // Remove old, add new
      const currentIds = assigningRole.permissions?.map((p) => p.id) ?? [];
      const newIds: string[] = values.permissionIds ?? [];
      const toAdd = newIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !newIds.includes(id));
      await Promise.all([
        ...toAdd.map((id) => rolesApi.assignPermission(assigningRole.id, id)),
        ...toRemove.map((id) => rolesApi.removePermission(assigningRole.id, id)),
      ]);
      message.success(t('common.success'));
      setPermModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleDelete = async (id: string) => {
    await rolesApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<Role>[] = [
    { title: t('rbac.roleName'), dataIndex: 'name', copyable: true },
    { title: t('rbac.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('rbac.permissions'),
      dataIndex: 'permissions',
      render: (_, record) =>
        record.permissions?.length
          ? record.permissions.map((p) => <Tag key={p.id}>{p.name}</Tag>)
          : <Text type="secondary">{t('rbac.noPermissions')}</Text>,
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 240,
      render: (_, record) => [
        <Button key="edit" type="link" size="small" onClick={() => openEdit(record)}>
          {t('common.edit')}
        </Button>,
        <Button key="perms" type="link" size="small" onClick={() => openAssignPerms(record)}>
          {t('rbac.assignPermissions')}
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
      <ProTable<Role>
        headerTitle={t('rbac.rolesTitle')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('rbac.createRole')}
          </Button>,
        ]}
        request={async () => {
          const data = await rolesApi.list();
          const items = Array.isArray(data) ? data : [];
          return { data: items, total: items.length, success: true };
        }}
        columns={columns}
        pagination={false}
      />

      <Modal
        title={editingId ? t('rbac.editRole') : t('rbac.createRole')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('rbac.roleName')} rules={[{ required: !editingId }]}>
            <Input disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="description" label={t('rbac.description')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('rbac.assignPermissions')}
        open={permModalOpen}
        onOk={handleAssignPerms}
        onCancel={() => setPermModalOpen(false)}
        destroyOnClose
        width={500}
      >
        <Form form={permForm} layout="vertical">
          <Form.Item name="permissionIds">
            <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allPerms.map((p) => (
                <Checkbox key={p.id} value={p.id}>
                  <Text strong>{p.name}</Text>
                  {p.description && <Text type="secondary"> — {p.description}</Text>}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
