import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <Result
      status="403"
      title="403"
      subTitle={t('common.forbidden', "Sorry, you don't have permission to access this page.")}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard', { replace: true })}>
          {t('common.backHome', 'Back to Dashboard')}
        </Button>
      }
    />
  );
}
