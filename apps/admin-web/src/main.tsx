import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import '@/locales/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import AppRouter from '@/router';

function Root() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        token: {
          colorPrimary: '#ffd400',
          // 亮黄主色上用深色文字，避免白字在黄底上不可读
          colorTextLightSolid: 'rgba(0, 0, 0, 0.88)',
          borderRadius: 8,
          fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Layout: { siderBg: '#ffffff' },
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
