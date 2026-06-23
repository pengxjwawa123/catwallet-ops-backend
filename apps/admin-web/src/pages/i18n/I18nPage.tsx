import { useRef, useState, useEffect, useMemo } from 'react';
import { Button, message, Select, Input } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { i18nApi } from '@/api';
import type { I18nConfigResponse } from '@/utils/types';

interface I18nRow {
  rowKey: string;
  key: string;
  language: string;
  value: string;
}

export default function I18nPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>();
  const [configData, setConfigData] = useState<I18nConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterLang, setFilterLang] = useState<string | undefined>(undefined);
  const [searchKey, setSearchKey] = useState('');

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

  const allRows: I18nRow[] = useMemo(() => {
    if (!configData?.langs) return [];
    const rows: I18nRow[] = [];
    for (const [lang, entries] of Object.entries(configData.langs)) {
      for (const [key, value] of Object.entries(entries)) {
        rows.push({ rowKey: `${lang}:${key}`, key, language: lang, value });
      }
    }
    rows.sort((a, b) => a.key.localeCompare(b.key) || a.language.localeCompare(b.language));
    return rows;
  }, [configData]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (filterLang) {
      rows = rows.filter((r) => r.language === filterLang);
    }
    if (searchKey) {
      const lower = searchKey.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.key.toLowerCase().includes(lower) ||
          r.value.toLowerCase().includes(lower),
      );
    }
    return rows;
  }, [allRows, filterLang, searchKey]);

  const languages = useMemo(() => {
    if (!configData?.langs) return [];
    return Object.keys(configData.langs).sort();
  }, [configData]);

  const columns: ProColumns<I18nRow>[] = [
    {
      title: t('i18n.key'),
      dataIndex: 'key',
      copyable: true,
      width: 280,
    },
    {
      title: t('i18n.language'),
      dataIndex: 'language',
      width: 100,
    },
    {
      title: t('i18n.value'),
      dataIndex: 'value',
      ellipsis: true,
    },
  ];

  return (
    <ProTable<I18nRow>
      headerTitle={t('i18n.title')}
      actionRef={actionRef}
      rowKey="rowKey"
      loading={loading}
      search={false}
      dataSource={filteredRows}
      toolBarRender={() => [
        <Input.Search
          key="search"
          placeholder={t('common.search')}
          allowClear
          style={{ width: 200 }}
          onSearch={(val) => setSearchKey(val)}
          onChange={(e) => { if (!e.target.value) setSearchKey(''); }}
        />,
        <Select
          key="lang-filter"
          allowClear
          placeholder={t('i18n.filterLanguage')}
          style={{ width: 140 }}
          value={filterLang}
          onChange={(val) => setFilterLang(val)}
          options={languages.map((l) => ({ label: l, value: l }))}
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
          disabled
          onClick={() => message.info(t('i18n.notImplemented'))}
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
  );
}
