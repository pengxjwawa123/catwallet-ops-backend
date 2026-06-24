import { useRef, useState, useEffect, useMemo } from 'react';
import { Button, message, Input, Modal, Form } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { i18nApi } from '@/api';
import type { I18nConfigResponse } from '@/utils/types';

interface I18nRow {
  key: string;
  [lang: string]: string;
}

export default function I18nPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [configData, setConfigData] = useState<I18nConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

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
    // TODO: call real API when backend is ready
    message.success(t('common.success'));
    setModalOpen(false);
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

  return (
    <>
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
    </>
  );
}
