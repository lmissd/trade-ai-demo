import { Card, Col, Empty, Image, List, Row, Space, Typography } from "antd";

const requirementFiles = [
  "/requirements/471a88f9f515bf1fa16f042b8bf08354.jpg",
  "/requirements/5996dd6e3d0f63a406534d304601de9d.jpg",
  "/requirements/8d96c3eec497dd3f82e4f707062818af.jpg",
  "/requirements/98764296674e8651e6770fae27d1d013.jpg",
  "/requirements/a79bfdb4762f7aeb91cf58109a9afb01.jpg",
  "/requirements/b633aea66ef3f95d5f8342bf5f9464c4.jpg",
  "/requirements/f9b968987ddbb67a1c6656c0c3326c01.jpg"
];

const testDocFiles = [
  "/test-docs/测试单据.png",
  "/test-docs/演示发票-50000USD.png",
  "/test-docs/演示合同-中国采购100箱.png",
  "/test-docs/演示提单-CONT-DEMO-202606-001.png",
  "/test-docs/演示箱单-赞比亚仓库100箱.png"
];

export function TestMaterialsPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <section className="page-hero">
        <Typography.Title level={2} style={{ margin: 0 }}>
          测试资料
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          这里集中放着客户测试用的需求截图和单据图片，可以直接打开预览和上传。
        </Typography.Paragraph>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="需求内容" className="placeholder-card">
            <List
              dataSource={requirementFiles}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Typography.Text>{item.split("/").pop()}</Typography.Text>
                    <Image src={item} alt={item} style={{ maxWidth: "100%", borderRadius: 12 }} />
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="测试单据" className="placeholder-card">
            <List
              dataSource={testDocFiles}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Typography.Text>{item.split("/").pop()}</Typography.Text>
                    <Image src={item} alt={item} style={{ maxWidth: "100%", borderRadius: 12 }} />
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
