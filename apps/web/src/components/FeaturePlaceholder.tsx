import { Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import type { ReactNode } from "react";

type StatItem = {
  label: string;
  value: string;
};

type FeaturePlaceholderProps = {
  icon: ReactNode;
  title: string;
  description: string;
  bullets: string[];
  badges: string[];
  stats?: StatItem[];
  mobileHint?: string;
};

export function FeaturePlaceholder({
  icon,
  title,
  description,
  bullets,
  badges,
  stats,
  mobileHint
}: FeaturePlaceholderProps) {
  return (
    <div>
      <section className="page-hero">
        <div className="placeholder-meta">
          <span className="placeholder-icon">{icon}</span>
          <div>
            <Typography.Title level={2}>{title}</Typography.Title>
            <Typography.Paragraph>{description}</Typography.Paragraph>
          </div>
        </div>

        <div className="placeholder-badges">
          {badges.map((badge) => (
            <Tag key={badge} color="blue">
              {badge}
            </Tag>
          ))}
        </div>
      </section>

      {stats ? (
        <Row gutter={[20, 20]} className="page-grid">
          {stats.map((stat) => (
            <Col key={stat.label} xs={24} sm={12} xl={6}>
              <Card className="stat-card">
                <Statistic title={stat.label} value={stat.value} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : null}

      <Card className="placeholder-card" style={{ marginTop: stats ? 24 : 0 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              当前页面包含
            </Typography.Title>
            <ol className="placeholder-list">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ol>
          </div>

          {mobileHint ? <div className="mobile-hint">{mobileHint}</div> : null}
        </Space>
      </Card>
    </div>
  );
}
