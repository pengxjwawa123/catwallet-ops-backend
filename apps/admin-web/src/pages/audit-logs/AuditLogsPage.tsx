import { useRef, useState } from 'react';
import { Button, Modal, Typography, DatePicker, Space } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { auditApi } from '@/api';
import type { AuditLog } from '@/utils/types';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const [detailRecord, setDetailRecord] = useState<AuditLog | null>(null);
  const [filter, setFilter] = useState<{ action?: string; target?: string; from?: string; to?: string }>({});

  const columns: ProColumns<AuditLog>[] = [
    { title: t('auditLogs.actor'), dataIndex: 'actorUsername', ellipsis: true, width: 120 },
    { title: t('auditLogs.action'), dataIndex: 'action', ellipsis: true, width: 140 },
    { title: t('auditLogs.target'), dataIndex: 'target', ellipsis: true, width: 120 },
    { title: t('auditLogs.targetId'), dataIndex: 'targetId', ellipsis: true, width: 120 },
    { title: t('auditLogs.ip'), dataIndex: 'ip', width: 130 },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
      sorter: false,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 100,
      render: (_, record) => [
        <Button key="detail" type="link" size="small" onClick={() => setDetailRecord(record)}>
          {t('auditLogs.viewDetail')}
        </Button>,
      ],
    },
  ];

  return (
    <>
      <ProTable<AuditLog>
        headerTitle={t('auditLogs.title')}
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Space key="filters">
            <input
              placeholder={t('auditLogs.action')}
              style={{ padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
              onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value || undefined }))}
            />
            <input
              placeholder={t('auditLogs.target')}
              style={{ padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
              onChange={(e) => setFilter((f) => ({ ...f, target: e.target.value || undefined }))}
            />
            <RangePicker
              size="small"
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilter((f) => ({
                    ...f,
                    from: dates[0]!.toISOString(),
                    to: dates[1]!.toISOString(),
                  }));
                } else {
                  setFilter((f) => ({ ...f, from: undefined, to: undefined }));
                }
              }}
            />
            <Button size="small" type="primary" onClick={() => actionRef.current?.reload()}>
              {t('common.search')}
            </Button>
          </Space>,
        ]}
        request={async ({ current = 1, pageSize = 20 }) => {
          const data = await auditApi.list({ page: current, pageSize, ...filter });
          return { data: data.items, total: data.total, success: true };
        }}
        columns={columns}
        pagination={{ showSizeChanger: true, defaultPageSize: 20 }}
      />

      <Modal
        title={t('auditLogs.detail')}
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={640}
      >
        {detailRecord && (
          <div>
            <p><Text strong>{t('auditLogs.actor')}:</Text> {detailRecord.actorUsername}</p>
            <p><Text strong>{t('auditLogs.action')}:</Text> {detailRecord.action}</p>
            <p><Text strong>{t('auditLogs.target')}:</Text> {detailRecord.target} / {detailRecord.targetId}</p>
            <p><Text strong>{t('auditLogs.ip')}:</Text> {detailRecord.ip}</p>
            <p><Text strong>{t('common.createdAt')}:</Text> {dayjs(detailRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
            {detailRecord.before !== undefined && (
              <>
                <Text strong>{t('auditLogs.before')}:</Text>
                <Paragraph>
                  <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detailRecord.before, null, 2)}
                  </pre>
                </Paragraph>
              </>
            )}
            {detailRecord.after !== undefined && (
              <>
                <Text strong>{t('auditLogs.after')}:</Text>
                <Paragraph>
                  <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detailRecord.after, null, 2)}
                  </pre>
                </Paragraph>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
