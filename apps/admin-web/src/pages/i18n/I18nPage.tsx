import { useRef, useState, useEffect, useMemo } from 'react';
import { Button, message, Input, Modal, Form, Upload, Table, Alert, Tabs, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { i18nApi } from '@/api';
import type { I18nConfigResponse, I18nOpLog } from '@/utils/types';
import dayjs from 'dayjs';

const { Paragraph } = Typography;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface I18nRow {
  key: string;
  [lang: string]: string;
}

export default function I18nPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const logActionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [configData, setConfigData] = useState<I18nConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<I18nRow[]>([]);
  const [logDetail, setLogDetail] = useState<I18nOpLog | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await i18nApi.getConfig();
      setConfigData(data);
    } catch {
      /* interceptor shows error */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const languages = useMemo(() => {
    if (!configData?.langs) return [];
    return Object.keys(configData.langs).sort();
  }, [configData]);

  const allRows: I18nRow[] = useMemo(() => {
    if (!configData?.langs) return [];
    const map: Record<string, I18nRow> = {};
    for (const [lang, entries] of Object.entries(configData.langs)) {
      for (const [key, value] of Object.entries(entries)) {
        if (!map[key]) map[key] = { key };
        map[key][lang] = value;
      }
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [configData]);

  const filteredRows = useMemo(() => {
    if (!searchKey) return allRows;
    const lower = searchKey.toLowerCase();
    return allRows.filter((row) => {
      if (row.key.toLowerCase().includes(lower)) return true;
      for (const lang of languages) {
        if (row[lang]?.toLowerCase().includes(lower)) return true;
      }
      return false;
    });
  }, [allRows, searchKey, languages]);

  const openCreate = () => {
    setEditingKey(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: I18nRow) => {
    setEditingKey(record.key);
    const values: Record<string, string> = { key: record.key };
    for (const lang of languages) {
      values[`lang_${lang}`] = record[lang] || '';
    }
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const translations: Record<string, string> = {};
    for (const lang of languages) {
      const val = values[`lang_${lang}`];
      if (val) translations[lang] = val;
    }
    if (!Object.keys(translations).length) {
      message.warning(t('i18n.atLeastOneLang'));
      return;
    }
    // TODO: call real upsert API when backend is ready
    try {
      await i18nApi.createOpLog({
        action: editingKey ? 'update' : 'create',
        operator: 'admin',
        key: values.key,
        detail: { translations },
      });
    } catch { /* non-critical */ }
    message.success(t('common.success'));
    setModalOpen(false);
    logActionRef.current?.reload();
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const csvRows = parseCsv(text);
        if (csvRows.length < 2) {
          message.error(t('i18n.importParseError'));
          return;
        }
        const header = csvRows[0].map((h) => h.trim().toLowerCase());
        const keyIdx = header.indexOf('key');
        if (keyIdx === -1) {
          message.error(t('i18n.importMissingKey'));
          return;
        }
        const langIndices: { lang: string; idx: number }[] = [];
        for (let i = 0; i < header.length; i++) {
          if (i !== keyIdx && header[i]) {
            langIndices.push({ lang: header[i], idx: i });
          }
        }
        const rows: I18nRow[] = [];
        for (let r = 1; r < csvRows.length; r++) {
          const cells = csvRows[r];
          const key = cells[keyIdx]?.trim();
          if (!key) continue;
          const row: I18nRow = { key };
          for (const { lang, idx } of langIndices) {
            const val = cells[idx]?.trim();
            if (val) row[lang] = val;
          }
          rows.push(row);
        }
        rows.sort((a, b) => a.key.localeCompare(b.key));
        setImportData(rows);
        setImportModalOpen(true);
      } catch {
        message.error(t('i18n.importParseError'));
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleImportConfirm = async () => {
    // TODO: call real batch import API when backend is ready
    try {
      await i18nApi.createOpLog({
        action: 'batch_import',
        operator: 'admin',
        detail: { count: importData.length, keys: importData.slice(0, 20).map((r) => r.key) },
      });
    } catch { /* non-critical */ }
    message.success(t('i18n.importSuccess', { count: importData.length }));
    setImportModalOpen(false);
    setImportData([]);
    logActionRef.current?.reload();
  };

  const handleDownloadTemplate = () => {
    const langs = languages.length ? languages : ['en', 'zh'];
    const header = ['key', ...langs].map(escapeCsvField).join(',');
    const example = [
      ['common.confirm', ...langs.map((l) => l === 'zh' ? '确认' : 'Confirm')],
      ['common.cancel', ...langs.map((l) => l === 'zh' ? '取消' : 'Cancel')],
    ].map((row) => row.map(escapeCsvField).join(','));
    const csv = [header, ...example].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'i18n_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ProColumns<I18nRow>[] = useMemo(() => {
    const cols: ProColumns<I18nRow>[] = [
      {
        title: t('i18n.key'),
        dataIndex: 'key',
        copyable: true,
        width: 220,
      },
      ...languages.map((lang) => ({
        title: lang.toUpperCase(),
        dataIndex: lang,
        ellipsis: true,
      })),
      {
        title: t('common.actions'),
        valueType: 'option' as const,
        width: 80,
        render: (_: unknown, record: I18nRow) => [
          <Button key="edit" type="link" size="small" onClick={() => openEdit(record)}>
            {t('common.edit')}
          </Button>,
        ],
      },
    ];
    return cols;
  }, [languages, t]);

  const logColumns: ProColumns<I18nOpLog>[] = [
    { title: t('i18n.log.action'), dataIndex: 'action', width: 120 },
    { title: t('i18n.log.operator'), dataIndex: 'operator', width: 120 },
    { title: t('i18n.log.key'), dataIndex: 'key', width: 200, ellipsis: true },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 80,
      render: (_, record) => [
        <Button key="detail" type="link" size="small" onClick={() => setLogDetail(record)}>
          {t('i18n.log.viewDetail')}
        </Button>,
      ],
    },
  ];

  return (
    <>
      <Tabs
        defaultActiveKey="translations"
        items={[
          {
            key: 'translations',
            label: t('i18n.tab.translations'),
            children: (
              <ProTable<I18nRow>
                headerTitle={t('i18n.title')}
                actionRef={actionRef}
                rowKey="key"
                loading={loading}
                search={false}
                dataSource={filteredRows}
                scroll={{ x: undefined }}
                toolBarRender={() => [
                  <Input.Search
                    key="search"
                    placeholder={t('common.search')}
                    allowClear
                    style={{ width: 240 }}
                    onSearch={(val) => setSearchKey(val)}
                    onChange={(e) => { if (!e.target.value) setSearchKey(''); }}
                  />,
                  <Button
                    key="reload"
                    icon={<ReloadOutlined />}
                    onClick={fetchConfig}
                  >
                    {t('common.reset')}
                  </Button>,
                  <Button
                    key="template"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadTemplate}
                  >
                    {t('i18n.downloadTemplate')}
                  </Button>,
                  <Upload
                    key="import"
                    accept=".csv"
                    showUploadList={false}
                    beforeUpload={handleImportFile}
                  >
                    <Button icon={<UploadOutlined />}>
                      {t('i18n.import')}
                    </Button>
                  </Upload>,
                  <Button
                    key="create"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreate}
                  >
                    {t('common.create')}
                  </Button>,
                ]}
                columns={columns}
                pagination={{
                  showSizeChanger: true,
                  defaultPageSize: 50,
                  pageSizeOptions: ['20', '50', '100', '200'],
                  showTotal: (total) => t('common.total', { total }),
                }}
              />
            ),
          },
          {
            key: 'logs',
            label: t('i18n.tab.opLogs'),
            children: (
              <ProTable<I18nOpLog>
                headerTitle={t('i18n.log.title')}
                actionRef={logActionRef}
                rowKey="id"
                search={false}
                request={async ({ current = 1, pageSize = 20 }) => {
                  const data = await i18nApi.getOpLogs({ page: current, pageSize });
                  return { data: data.items, total: data.total, success: true };
                }}
                columns={logColumns}
                pagination={{ showSizeChanger: true, defaultPageSize: 20 }}
              />
            ),
          },
        ]}
      />

      <Modal
        title={editingKey ? t('i18n.editEntry') : t('i18n.createEntry')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label={t('i18n.key')}
            rules={[{ required: true, message: t('i18n.keyRequired') }]}
          >
            <Input disabled={!!editingKey} placeholder="e.g. common.cancel" />
          </Form.Item>
          {languages.map((lang) => (
            <Form.Item
              key={lang}
              name={`lang_${lang}`}
              label={lang.toUpperCase()}
            >
              <Input.TextArea rows={2} placeholder={t('i18n.valuePlaceholder', { lang: lang.toUpperCase() })} />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Modal
        title={t('i18n.importPreview')}
        open={importModalOpen}
        onOk={handleImportConfirm}
        onCancel={() => { setImportModalOpen(false); setImportData([]); }}
        width={800}
        okText={t('i18n.confirmImport')}
      >
        <Alert
          type="info"
          showIcon
          message={t('i18n.importPreviewTip', { count: importData.length })}
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={importData.slice(0, 100)}
          rowKey="key"
          size="small"
          scroll={{ y: 400 }}
          pagination={false}
          columns={[
            { title: 'Key', dataIndex: 'key', width: 200, ellipsis: true },
            ...languages.map((lang) => ({
              title: lang.toUpperCase(),
              dataIndex: lang,
              ellipsis: true,
            })),
          ]}
        />
        {importData.length > 100 && (
          <div style={{ marginTop: 8, color: '#999' }}>
            {t('i18n.importShowingPartial', { shown: 100, total: importData.length })}
          </div>
        )}
      </Modal>

      <Modal
        title={t('i18n.log.detailTitle')}
        open={!!logDetail}
        onCancel={() => setLogDetail(null)}
        footer={null}
        width={600}
      >
        {logDetail && (
          <div>
            <p><strong>{t('i18n.log.action')}:</strong> {logDetail.action}</p>
            <p><strong>{t('i18n.log.operator')}:</strong> {logDetail.operator || '-'}</p>
            <p><strong>{t('i18n.log.key')}:</strong> {logDetail.key || '-'}</p>
            <p><strong>{t('common.createdAt')}:</strong> {dayjs(logDetail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
            {logDetail.detail !== undefined && (
              <>
                <strong>{t('i18n.log.detail')}:</strong>
                <Paragraph>
                  <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                    {JSON.stringify(logDetail.detail, null, 2)}
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
