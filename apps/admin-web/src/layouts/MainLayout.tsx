import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Button, Space, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SafetyOutlined,
  AuditOutlined,
  FlagOutlined,
  SettingOutlined,
  NotificationOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  GlobalOutlined,
  KeyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api';
import { storage } from '@/utils/storage';
import Setup2FAModal from '@/components/Setup2FAModal';
import i18n from '@/locales/i18n';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function MainLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearAuth, username, superAdmin, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const { token } = theme.useToken();

  const handleLogout = async () => {
    const refresh = storage.getRefresh();
    try { if (refresh) await authApi.logout(refresh); } catch { /* ignore */ }
    clearAuth();
    navigate('/login', { replace: true });
  };

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('cw_lang', lang);
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('nav.dashboard'),
      show: true,
    },
    {
      key: '/ops-users',
      icon: <UserOutlined />,
      label: t('nav.opsUsers'),
      show: superAdmin || hasPermission('ops_user:read'),
    },
    {
      key: 'rbac',
      icon: <SafetyOutlined />,
      label: t('nav.rbac'),
      show: superAdmin || hasPermission('rbac:manage'),
      children: [
        { key: '/rbac/roles', label: t('nav.roles') },
        { key: '/rbac/permissions', label: t('nav.permissions') },
      ],
    },
    {
      key: '/audit-logs',
      icon: <AuditOutlined />,
      label: t('nav.auditLogs'),
      show: superAdmin || hasPermission('audit:read'),
    },
    {
      key: '/feature-flags',
      icon: <FlagOutlined />,
      label: t('nav.featureFlags'),
      show: superAdmin || hasPermission('feature_flag:read'),
    },
    {
      key: '/remote-configs',
      icon: <SettingOutlined />,
      label: t('nav.remoteConfigs'),
      show: superAdmin || hasPermission('remote_config:read'),
    },
    {
      key: '/announcements',
      icon: <NotificationOutlined />,
      label: t('nav.announcements'),
      show: superAdmin || hasPermission('announcement:read'),
    },
    {
      key: '/i18n',
      icon: <TranslationOutlined />,
      label: t('nav.i18n'),
      show: superAdmin || hasPermission('i18n:read'),
    },
    {
      key: '/jobs',
      icon: <ClockCircleOutlined />,
      label: t('nav.jobs'),
      show: true,
    },
  ]
    .filter((item) => item.show)
    .map(({ show: _show, ...rest }) => rest);

  const selectedKey = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const openKeys = location.pathname.startsWith('/rbac') ? ['rbac'] : [];

  const userMenu = {
    items: [
      {
        key: 'setup2fa',
        icon: <KeyOutlined />,
        label: t('auth.setup2FA'),
        onClick: () => setSetup2FAOpen(true),
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('auth.logout'),
        onClick: handleLogout,
      },
    ],
  };

  const langMenu = {
    items: [
      { key: 'zh-CN', label: '中文', onClick: () => switchLang('zh-CN') },
      { key: 'en-US', label: 'English', onClick: () => switchLang('en-US') },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
        width={220}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            fontWeight: 700,
            fontSize: 16,
            color: 'rgba(0, 0, 0, 0.88)',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            letterSpacing: 1,
          }}
        >
          {collapsed ? 'CW' : 'CatWallet Ops'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={openKeys}
          style={{ border: 'none', marginTop: 8 }}
          items={menuItems as typeof menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          <Space>
            <Dropdown menu={langMenu} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />} />
            </Dropdown>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Button type="text">
                <Space>
                  <UserOutlined />
                  <Text style={{ maxWidth: 120 }} ellipsis>{username}</Text>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 'calc(100vh - 56px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <Setup2FAModal open={setup2FAOpen} onClose={() => setSetup2FAOpen(false)} />
    </Layout>
  );
}
