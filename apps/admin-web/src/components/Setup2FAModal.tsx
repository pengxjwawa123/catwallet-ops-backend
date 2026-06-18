import { useState } from 'react';
import { Modal, Form, Input, Button, QRCode, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Setup2FAModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'init' | 'scan' | 'verify'>('init');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const data = await authApi.setup2FA();
      setOtpauthUrl(data.otpauthUrl);
      setStep('scan');
    } catch {
      // error shown by interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (values: { token: string }) => {
    setLoading(true);
    try {
      await authApi.enable2FA(values.token);
      message.success(t('auth.twoFaEnabled'));
      setStep('init');
      onClose();
    } catch {
      // error shown by interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('init');
    onClose();
  };

  return (
    <Modal
      title={t('auth.setup2FA')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={400}
    >
      {step === 'init' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Button type="primary" loading={loading} onClick={handleSetup}>
            {t('auth.setup2FA')}
          </Button>
        </div>
      )}
      {step === 'scan' && (
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">{t('auth.scan2FAQr')}</Text>
          <div style={{ margin: '16px auto', display: 'inline-block' }}>
            <QRCode value={otpauthUrl} size={200} />
          </div>
          <Button type="link" onClick={() => setStep('verify')}>
            {t('auth.twoFaCode')} →
          </Button>
        </div>
      )}
      {step === 'verify' && (
        <Form onFinish={handleEnable} layout="vertical">
          <Form.Item
            name="token"
            label={t('auth.twoFaCode')}
            rules={[{ required: true, len: 6, message: t('auth.twoFaPlaceholder') }]}
          >
            <Input placeholder={t('auth.twoFaPlaceholder')} maxLength={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('auth.enable2FA')}
          </Button>
        </Form>
      )}
    </Modal>
  );
}
