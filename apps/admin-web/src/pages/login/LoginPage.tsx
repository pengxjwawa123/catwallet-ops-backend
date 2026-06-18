import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, message, Divider } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api';
import i18n from '@/locales/i18n';

const { Title, Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

interface TwoFAForm {
  token: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setTokens } = useAuth();
  const [loading, setLoading] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string>('');
  const [lang, setLang] = useState(localStorage.getItem('cw_lang') ?? 'zh-CN');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const switchLang = (l: string) => {
    setLang(l);
    i18n.changeLanguage(l);
    localStorage.setItem('cw_lang', l);
  };

  const handleLogin = async (values: LoginForm) => {
    setLoading(true);
    try {
      const data = await authApi.login(values.username, values.password);
      if (data.requires2FA) {
        setPendingUserId(data.userId ?? '');
        setTwoFAStep(true);
      } else if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
        message.success(t('auth.loginSuccess'));
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (values: TwoFAForm) => {
    setLoading(true);
    try {
      const data = await authApi.verify2FA(pendingUserId, values.token);
      if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
        message.success(t('auth.loginSuccess'));
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      }}
    >
      <Card
        style={{ width: 420, borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, letterSpacing: 1 }}>
            CatWallet Ops
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {twoFAStep ? t('auth.twoFaTitle') : t('auth.welcomeBack')}
          </Text>
        </div>

        {!twoFAStep ? (
          <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
            <Form.Item
              name="username"
              label={t('auth.username')}
              rules={[{ required: true, message: t('auth.usernamePlaceholder') }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.usernamePlaceholder')}
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('auth.password')}
              rules={[{ required: true, message: t('auth.passwordPlaceholder') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('auth.passwordPlaceholder')}
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                {t('auth.login')}
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleVerify2FA} autoComplete="off">
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
              {t('auth.twoFaDesc')}
            </Text>
            <Form.Item
              name="token"
              label={t('auth.twoFaCode')}
              rules={[{ required: true, len: 6, message: t('auth.twoFaPlaceholder') }]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder={t('auth.twoFaPlaceholder')}
                maxLength={6}
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                {t('common.confirm')}
              </Button>
            </Form.Item>
            <Button type="link" block onClick={() => setTwoFAStep(false)}>
              ← {t('auth.login')}
            </Button>
          </Form>
        )}

        <Divider style={{ margin: '16px 0' }} />
        <Space style={{ justifyContent: 'center', width: '100%' }}>
          <Button
            type={lang === 'zh-CN' ? 'link' : 'text'}
            size="small"
            onClick={() => switchLang('zh-CN')}
          >
            中文
          </Button>
          <Button
            type={lang === 'en-US' ? 'link' : 'text'}
            size="small"
            onClick={() => switchLang('en-US')}
          >
            English
          </Button>
        </Space>
      </Card>
    </div>
  );
}
