import { useRef, useState, useEffect, useMemo } from 'react';
import { Button, message, Input, Modal, Form, Upload, Tabs, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { i18nApi } from '@/api';
import type { I18nConfigItem, I18nOpLog } from '@/utils/types';
import dayjs from 'dayjs';

const { Paragraph } = Typography;

interface I18nCell {
  id: number;
  value: string;
}

interface I18nRow {
  configKey: string;
  // per-language cell keyed by lang code, e.g. zh / en
  [lang: string]: I18nCell | string;
}

export default function I18nPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const logActionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [items, setItems] = useState<I18nConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<I18nRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [logDetail, setLogDetail] = useState<I18nOpLog | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setSearching(false);
    setSearchKey('');
    try {
      const data = await i18nApi.list();
      setItems(data ?? []);
    } catch {
      /* interceptor shows error */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleSearch = async (keyword: string) => {
    const kw = keyword.trim();
    if (!kw) {
      fetchList();
      return;
    }
    setLoading(true);
    setSearching(true);
    setSearchKey(kw);
    try {
      const data = await i18nApi.search(kw);
      setItems(data ?? []);
    } catch {
      /* interceptor shows error */
    } finally {
      setLoading(false);
    }
  };

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) set.add(item.lang);
    const langs = Array.from(set);
    // keep a stable, conventional order: zh, en, then the rest alphabetically
    const priority = ['zh', 'en'];
    return langs.sort((a, b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    });
  }, [items]);

  const rows: I18nRow[] = useMemo(() => {
    const map: Record<string, I18nRow> = {};
    for (const item of items) {
      if (!map[item.configKey]) map[item.configKey] = { configKey: item.configKey };
      map[item.configKey][item.lang] = { id: item.id, value: item.value };
    }
    return Object.values(map).sort((a, b) => a.configKey.localeCompare(b.configKey));
  }, [items]);

  const getCell = (row: I18nRow, lang: string): I18nCell | undefined => {
    const cell = row[lang];
    return typeof cell === 'object' ? cell : undefined;
  };

  const openCreate = () => {
    setEditingRow(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: I18nRow) => {
    setEditingRow(record);
    const values: Record<string, string> = { configKey: record.configKey };
    for (const lang of languages) {
      values[`lang_${lang}`] = getCell(record, lang)?.value ?? '';
    }
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editingRow) {
        // Update each changed language entry individually (API updates by id).
        const updates: Promise<unknown>[] = [];
        const changed: Record<string, string> = {};
        const skipped: string[] = [];
        for (const lang of languages) {
          const cell = getCell(editingRow, lang);
          const next = values[`lang_${lang}`] ?? '';
          if (cell) {
            if (next !== cell.value) {
              updates.push(
                i18nApi.update({ configKey: editingRow.configKey, id: String(cell.id), value: next }),
              );
              changed[lang] = next;
            }
          } else if (next.trim()) {
            // Upstream update works by entry id; a language with no existing
            // entry cannot be added through this endpoint.
            skipped.push(lang.toUpperCase());
          }
        }
        if (skipped.length) {
          message.warning(t('i18n.langNotAddable', { langs: skipped.join(', ') }));
        }
        if (!updates.length) {
          if (!skipped.length) message.info(t('i18n.noChanges'));
          setModalOpen(false);
          return;
        }
        await Promise.all(updates);
        i18nApi
          .createOpLog({ action: 'update', operator: 'admin', key: editingRow.configKey, detail: { changed } })
          .catch(() => {});
      } else {
        await i18nApi.add({ configKey: values.configKey, zh: values.lang_zh, en: values.lang_en });
        i18nApi
          .createOpLog({
            action: 'create',
            operator: 'admin',
            key: values.configKey,
            detail: { zh: values.lang_zh, en: values.lang_en },
          })
          .catch(() => {});
      }
      message.success(t('common.success'));
      setModalOpen(false);
      if (searching && searchKey) {
        handleSearch(searchKey);
      } else {
        fetchList();
      }
      logActionRef.current?.reload();
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      await i18nApi.batchImport(file);
      i18nApi
        .createOpLog({ action: 'batch_import', operator: 'admin', detail: { fileName: file.name } })
        .catch(() => {});
      message.success(t('i18n.importSuccess'));
      fetchList();
      logActionRef.current?.reload();
    } catch {
      /* interceptor shows error */
    } finally {
      setImporting(false);
    }
    return false;
  };

  const columns: ProColumns<I18nRow>[] = useMemo(() => {
    const cols: ProColumns<I18nRow>[] = [
      {
        title: t('i18n.key'),
        dataIndex: 'configKey',
        copyable: true,
        width: 260,
      },
      ...languages.map((lang) => ({
        title: lang.toUpperCase(),
        ellipsis: true,
        render: (_: unknown, record: I18nRow) => getCell(record, lang)?.value ?? '-',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // For create, the add API requires zh + en; for edit, show whatever languages exist.
  const formLangs = editingRow ? languages : ['zh', 'en'];

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
                rowKey="configKey"
                loading={loading}
                search={false}
                dataSource={rows}
                scroll={{ x: undefined }}
                toolBarRender={() => [
                  <Input.Search
                    key="search"
                    placeholder={t('common.search')}
                    allowClear
                    style={{ width: 280 }}
                    onSearch={handleSearch}
                    onChange={(e) => { if (!e.target.value && searching) fetchList(); }}
                  />,
                  <Button
                    key="reload"
                    icon={<ReloadOutlined />}
                    onClick={fetchList}
                  >
                    {t('common.reset')}
                  </Button>,
                  <Upload
                    key="import"
                    accept=".xlsx,.xls"
                    showUploadList={false}
                    beforeUpload={handleImportFile}
                  >
                    <Button icon={<UploadOutlined />} loading={importing}>
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
        title={editingRow ? t('i18n.editEntry') : t('i18n.createEntry')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="configKey"
            label={t('i18n.key')}
            rules={[{ required: true, message: t('i18n.keyRequired') }]}
          >
            <Input disabled={!!editingRow} placeholder="e.g. common.cancel" />
          </Form.Item>
          {formLangs.map((lang) => (
            <Form.Item
              key={lang}
              name={`lang_${lang}`}
              label={lang.toUpperCase()}
              rules={editingRow ? [] : [{ required: true, message: t('i18n.valueRequired') }]}
            >
              <Input.TextArea rows={2} placeholder={t('i18n.valuePlaceholder', { lang: lang.toUpperCase() })} />
            </Form.Item>
          ))}
        </Form>
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
