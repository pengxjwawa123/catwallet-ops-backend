import { useState } from 'react';
import { Card, Upload, Spin, message, Steps, Button, Typography, Space } from 'antd';
import { UploadOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { appApi } from '@/api';

const { Paragraph, Text } = Typography;

export default function AppUploadPage() {
  const { t } = useTranslation();
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1: fetch the presigned S3 URL from our backend.
  const handleGetUrl = async () => {
    setFetchingUrl(true);
    try {
      const url = await appApi.getUploadUrl();
      setUploadUrl(url);
      setDone(false);
    } catch {
      // getUploadUrl goes through axios, whose interceptor shows the error.
    } finally {
      setFetchingUrl(false);
    }
  };

  // Step 2: PUT the chosen file directly to S3 using the presigned URL.
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await appApi.uploadToUrl(uploadUrl, file);
      setDone(true);
      message.success(t('appUpload.success'));
    } catch (err) {
      // The direct-to-S3 PUT uses native fetch, so show its failure explicitly.
      message.error(err instanceof Error ? err.message : t('appUpload.failed'));
    } finally {
      setUploading(false);
    }
    // Return false so antd's Upload does not attempt its own XHR upload.
    return false;
  };

  return (
    <Card title={t('appUpload.title')}>
      <div style={{ maxWidth: 640, margin: '8px auto' }}>
        <Steps
          current={uploadUrl ? 1 : 0}
          items={[{ title: t('appUpload.step1') }, { title: t('appUpload.step2') }]}
          style={{ marginBottom: 32 }}
        />

        {/* Step 1: get the presigned URL */}
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            loading={fetchingUrl}
            onClick={handleGetUrl}
          >
            {uploadUrl ? t('appUpload.getUrlAgain') : t('appUpload.getUrl')}
          </Button>

          {uploadUrl && (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <Text strong>{t('appUpload.urlReady')}</Text>
              <Paragraph copyable={{ text: uploadUrl }} ellipsis={{ rows: 2 }} style={{ marginTop: 4 }}>
                {uploadUrl}
              </Paragraph>
            </Paragraph>
          )}
        </Space>

        {/* Step 2: upload the file to the URL */}
        {uploadUrl && (
          <Spin spinning={uploading} tip={t('appUpload.uploading')}>
            <div style={{ marginTop: 24 }}>
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
              {done && (
                <Text type="success" style={{ display: 'block', marginTop: 12, textAlign: 'center' }}>
                  {t('appUpload.success')}
                </Text>
              )}
            </div>
          </Spin>
        )}
      </div>
    </Card>
  );
}
