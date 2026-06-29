import { useRef, useState } from 'react';
import { Button, Tag, Popconfirm, Modal, Form, Input, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { announcementsApi } from '@/api';
import type { Announcement } from '@/utils/types';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/utils/permissions';

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'green',
  ARCHIVED: 'orange',
};

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const { superAdmin, hasPermission } = useAuth();
  const canManage = superAdmin || hasPermission(PERMISSIONS.announcement.manage);
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'DRAFT': return t('announcements.draft');
      case 'PUBLISHED': return t('announcements.published');
      case 'ARCHIVED': return t('announcements.archived');
      default: return s;
    }
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Announcement) => {
    setEditingId(record.id);
    form.setFieldsValue({ title: record.title, content: record.content });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingId) {
        await announcementsApi.update(editingId, values);
      } else {
        await announcementsApi.create(values);
      }
      message.success(t('common.success'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const handleAction = async (action: 'publish' | 'unpublish' | 'archive', id: string) => {
    await announcementsApi[action](id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const handleDelete = async (id: string) => {
    await announcementsApi.remove(id);
    message.success(t('common.success'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<Announcement>[] = [
    { title: t('announcements.announcementTitle'), dataIndex: 'title', ellipsis: true },
    { title: t('announcements.content'), dataIndex: 'content', ellipsis: true },
    {
      title: t('announcements.status'),
      dataIndex: 'status',
      render: (_, record) => (
        <Tag color={statusColor[record.status]}>{statusLabel(record.status)}</Tag>
      ),
    },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 320,
      render: (_, record) => (
        <Space size={0} wrap>
          {canManage && (
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              {t('common.edit')}
            </Button>
          )}
          {canManage && record.status === 'DRAFT' && (
            <Button type="link" size="small" onClick={() => handleAction('publish', record.id)}>
              {t('announcements.publish')}
            </Button>
          )}
          {canManage && record.status === 'PUBLISHED' && (
            <Button type="link" size="small" onClick={() => handleAction('unpublish', record.id)}>
              {t('announcements.unpublish')}
            </Button>
          )}
          {canManage && record.status !== 'ARCHIVED' && (
            <Button type="link" size="small" onClick={() => handleAction('archive', record.id)}>
              {t('announcements.archive')}
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title={t('common.confirmDelete')}
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProTable<Announcement>
        headerTitle={t('announcements.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => canManage ? [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('announcements.createAnn')}
          </Button>,
        ] : []}
        request={async ({ current = 1, pageSize = 10 }) => {
          const data = await announcementsApi.list({ page: current, pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true }}
      />

      <Modal
        title={editingId ? t('announcements.editAnn') : t('announcements.createAnn')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('announcements.announcementTitle')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label={t('announcements.content')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
