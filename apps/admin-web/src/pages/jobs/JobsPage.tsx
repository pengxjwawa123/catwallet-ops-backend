import { useRef, useState } from 'react';
import { Button, Tag, Modal, Form, Input, Select, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { jobsApi } from '@/api';
import type { Job } from '@/utils/types';
import { useAuth } from '@/hooks/useAuth';

const { Text, Paragraph } = Typography;

const STATUS_COLOR: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  active: 'blue',
  waiting: 'orange',
  delayed: 'purple',
};

export default function JobsPage() {
  const { t } = useTranslation();
  const { superAdmin } = useAuth();
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [enqueueOpen, setEnqueueOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const handleEnqueue = async () => {
    const values = await form.validateFields();
    let payload: unknown = undefined;
    if (values.payload) {
      try { payload = JSON.parse(values.payload); } catch { payload = values.payload; }
    }
    try {
      await jobsApi.enqueue({ name: values.name, payload });
      message.success(t('common.success'));
      setEnqueueOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch { /* interceptor shows error */ }
  };

  const columns: ProColumns<Job>[] = [
    { title: t('jobs.jobName'), dataIndex: 'name', ellipsis: true },
    { title: t('jobs.queue'), dataIndex: 'queue', ellipsis: true, width: 120 },
    {
      title: t('jobs.status'),
      dataIndex: 'status',
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status] ?? 'default'}>{record.status}</Tag>
      ),
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, record) => [
        <Button key="detail" type="link" size="small" onClick={() => setDetailJob(record)}>
          {t('jobs.viewDetail')}
        </Button>,
      ],
    },
  ];

  return (
    <>
      <ProTable<Job>
        headerTitle={t('jobs.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() =>
          superAdmin
            ? [
                <Button key="enqueue" type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEnqueueOpen(true); }}>
                  {t('jobs.enqueue')}
                </Button>,
              ]
            : []
        }
        request={async ({ current = 1, pageSize = 20 }) => {
          const data = await jobsApi.list({ page: current, pageSize });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true, defaultPageSize: 20 }}
      />

      {superAdmin && (
        <Modal
          title={t('jobs.enqueue')}
          open={enqueueOpen}
          onOk={handleEnqueue}
          onCancel={() => setEnqueueOpen(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label={t('jobs.jobName')} rules={[{ required: true }]}>
              <Input placeholder="e.g. send-email" />
            </Form.Item>
            <Form.Item name="payload" label={t('jobs.payload')}>
              <Input.TextArea rows={4} placeholder='{"to":"user@example.com"}' />
            </Form.Item>
          </Form>
        </Modal>
      )}

      <Modal
        title={t('jobs.viewDetail')}
        open={!!detailJob}
        onCancel={() => setDetailJob(null)}
        footer={null}
        width={640}
      >
        {detailJob && (
          <div>
            <p><Text strong>{t('jobs.jobName')}:</Text> {detailJob.name}</p>
            <p><Text strong>{t('jobs.queue')}:</Text> {detailJob.queue}</p>
            <p><Text strong>{t('jobs.status')}:</Text> {detailJob.status}</p>
            {detailJob.payload !== undefined && (
              <>
                <Text strong>{t('jobs.payload')}:</Text>
                <Paragraph>
                  <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detailJob.payload, null, 2)}
                  </pre>
                </Paragraph>
              </>
            )}
            {detailJob.result !== undefined && (
              <>
                <Text strong>{t('jobs.result')}:</Text>
                <Paragraph>
                  <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detailJob.result, null, 2)}
                  </pre>
                </Paragraph>
              </>
            )}
            {detailJob.failReason && (
              <p><Text type="danger"><Text strong>{t('jobs.failReason')}:</Text> {detailJob.failReason}</Text></p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
