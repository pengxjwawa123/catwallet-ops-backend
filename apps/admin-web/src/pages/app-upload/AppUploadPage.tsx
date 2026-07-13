import { useState } from 'react';
import { Card, Upload, Spin, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { appApi } from '@/api';

export default function AppUploadPage() {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await appApi.upload(file);
      message.success(t('appUpload.success'));
    } catch {
      /* interceptor shows error */
    } finally {
      setUploading(false);
    }
    // Return false so antd's Upload does not attempt its own XHR upload.
    return false;
  };

  return (
    <Card title={t('appUpload.title')}>
      <Spin spinning={uploading} tip={t('appUpload.uploading')}>
        <div style={{ maxWidth: 560, margin: '24px auto' }}>
          <Upload.Dragger
            accept=".apk"
            multiple={false}
            showUploadList={false}
            disabled={uploading}
            beforeUpload={handleUpload}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{t('appUpload.prompt')}</p>
            <p className="ant-upload-hint">{t('appUpload.hint')}</p>
          </Upload.Dragger>
        </div>
      </Spin>
    </Card>
  );
}
