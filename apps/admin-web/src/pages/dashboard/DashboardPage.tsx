import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space } from 'antd';
import {
  UserOutlined,
  FlagOutlined,
  SettingOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { opsUsersApi, featureFlagsApi, remoteConfigsApi, announcementsApi } from '@/api';

const { Title, Text } = Typography;

interface Stats {
  users: number;
  flags: number;
  configs: number;
  announcements: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({ users: 0, flags: 0, configs: 0, announcements: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      opsUsersApi.list({ page: 1, pageSize: 1 }),
      featureFlagsApi.list({ page: 1, pageSize: 1 }),
      remoteConfigsApi.list({ page: 1, pageSize: 1 }),
      announcementsApi.list({ page: 1, pageSize: 1 }),
    ]).then(([u, f, c, a]) => {
      setStats({
        users:         u.status === 'fulfilled' ? u.value.total : 0,
        flags:         f.status === 'fulfilled' ? f.value.total : 0,
        configs:       c.status === 'fulfilled' ? c.value.total : 0,
        announcements: a.status === 'fulfilled' ? a.value.total : 0,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { title: t('dashboard.totalUsers'),         value: stats.users,         icon: <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} /> },
    { title: t('dashboard.totalFlags'),         value: stats.flags,         icon: <FlagOutlined style={{ fontSize: 24, color: '#52c41a' }} /> },
    { title: t('dashboard.totalConfigs'),       value: stats.configs,       icon: <SettingOutlined style={{ fontSize: 24, color: '#fa8c16' }} /> },
    { title: t('dashboard.totalAnnouncements'), value: stats.announcements, icon: <NotificationOutlined style={{ fontSize: 24, color: '#722ed1' }} /> },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>{t('dashboard.title')}</Title>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col key={card.title} xs={24} sm={12} lg={6}>
            <Card loading={loading}>
              <Space>
                {card.icon}
                <Statistic title={<Text type="secondary">{card.title}</Text>} value={card.value} />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
