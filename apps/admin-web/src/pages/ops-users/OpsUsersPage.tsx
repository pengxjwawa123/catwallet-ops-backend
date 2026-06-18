import { useRef, useState } from 'react';
import { Button, Space, Tag, Popconfirm, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { opsUsersApi, rolesApi } from '@/api';
import type { OpsUser, Role } from '@/utils/types';
import { useAuth } from '@/hooks/useAuth';

export default function OpsUsersPage() {
  const { t } = useTranslation();
  const { hasPermission, superAdmin } = useAuth();
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const canWrite = superAdmin || hasPermission('ops_user:create') || hasPermission('ops_user:update');

  const loadRoles = async () => {
    try {
      const data = await rolesApi.list();
      setRoles(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    loadRoles();
    setModalOpen(true);
  };

  const openEdit = (record: OpsUser) => {
    setEditingId(record.id);
    form.setFieldsValue({ username: record.username, email: record.email });
    loadRoles();
    setModalOpen(true);
  };

  const openPwd = (record: OpsUser) => {
    setEditingId(record.id);
    pwdForm.resetFields();
    setPwdModalOpen(true);
  };

  const openRole = (record: OpsUser) => {
    setEditingId(record.id);
    loadRoles();
    roleForm.resetFields();
    setRoleModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingId) {
        await opsUsersApi.update(editingId, values);
      } else {
        await opsUsersApi.create(values);
      }
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handlePwdSubmit = async () => {
    const values = await pwdForm.validateFields();
    try {
      await opsUsersApi.resetPassword(editingId!, values.password);
      message.success(t('common.success'));
      setPwdModalOpen(false);
    } catch { /* interceptor shows error */ }
  };

  const handleRoleSubmit = async () => {
    const values = await roleForm.validateFields();
    try {
      await rolesApi.assignRoleToUser(editingId!, values.roleId);
      message.success(t('common.success'));
      setRoleModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleDelete = async (id: string) => {
    await opsUsersApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const toggleStatus = async (record: OpsUser) => {
    const next = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await opsUsersApi.setStatus(record.id, next);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<OpsUser>[] = [
    { title: t('opsUsers.username'), dataIndex: 'username', copyable: true },
    { title: t('opsUsers.email'), dataIndex: 'email', ellipsis: true },
    {
      title: t('opsUsers.role'),
      dataIndex: 'roles',
      render: (_, record) =>
        record.roles?.map((r) => <Tag key={r.id}>{r.name}</Tag>),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, record) => (
        <Tag color={record.status === 'ACTIVE' ? 'green' : 'red'}>
          {record.status === 'ACTIVE' ? t('opsUsers.active') : t('opsUsers.inactive')}
        </Tag>
      ),
    },
    {
      title: t('opsUsers.assign2FA'),
      dataIndex: 'twoFactorEnabled',
      render: (_, record) => (
        <Tag color={record.twoFactorEnabled ? 'blue' : 'default'}>
          {record.twoFactorEnabled ? t('common.yes') : t('common.no')}
        </Tag>
      ),
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 280,
      render: (_, record) =>
        canWrite
          ? [
              <Button key="edit" type="link" size="small" onClick={() => openEdit(record)}>
                {t('common.edit')}
              </Button>,
              <Button key="pwd" type="link" size="small" onClick={() => openPwd(record)}>
                {t('opsUsers.resetPassword')}
              </Button>,
              <Button key="role" type="link" size="small" onClick={() => openRole(record)}>
                {t('opsUsers.assignRole')}
              </Button>,
              <Button
                key="toggle"
                type="link"
                size="small"
                onClick={() => toggleStatus(record)}
              >
                {record.status === 'ACTIVE' ? t('opsUsers.deactivate') : t('opsUsers.activate')}
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
            ]
          : [],
    },
  ];

  return (
    <>
      <ProTable<OpsUser>
        headerTitle={t('opsUsers.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() =>
          canWrite
            ? [
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  {t('opsUsers.createUser')}
                </Button>,
              ]
            : []
        }
        request={async ({ current = 1, pageSize = 10 }) => {
          const data = await opsUsersApi.list({ page: current, pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true }}
      />

      <Modal
        title={editingId ? t('opsUsers.editUser') : t('opsUsers.createUser')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label={t('opsUsers.username')} rules={[{ required: !editingId }]}>
            <Input disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="email" label={t('opsUsers.email')}>
            <Input />
          </Form.Item>
          {!editingId && (
            <Form.Item name="password" label={t('auth.password')} rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="roleName" label={t('opsUsers.roleName')}>
            <Select allowClear placeholder={t('opsUsers.roleName')}>
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.name}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('opsUsers.resetPassword')}
        open={pwdModalOpen}
        onOk={handlePwdSubmit}
        onCancel={() => setPwdModalOpen(false)}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label={t('opsUsers.newPassword')} rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('opsUsers.assignRole')}
        open={roleModalOpen}
        onOk={handleRoleSubmit}
        onCancel={() => setRoleModalOpen(false)}
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="roleId" label={t('opsUsers.role')} rules={[{ required: true }]}>
            <Select>
              {roles.map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
