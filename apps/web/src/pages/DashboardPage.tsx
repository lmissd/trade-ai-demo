import { ApiOutlined, BarChartOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Button, Card, Space, Typography } from "antd";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DashboardPage() {
  return (
    <>
      <FeaturePlaceholder
        icon={<BarChartOutlined />}
        title="国际贸易 ERP 驾驶舱骨架"
        description="新版阶段 1 先把完整 ERP 菜单、老板视角总入口和演示讲述顺序搭出来，让你双击启动后就能直接检阅整体形态。"
        badges={["14 菜单骨架", "老板视角入口", "双击 BAT 可预览"]}
        stats={[
          { label: "真实核心闭环", value: "8 步" },
          { label: "成熟展示模块", value: "10 个" },
          { label: "目标菜单入口", value: "14 项" },
          { label: "默认预览页", value: "/dashboard" }
        ]}
        bullets={[
          "后续首页会同时展示真实库存统计、二维码状态、工单提醒和外围模块推进状态。",
          "当前阶段重点是让甲方一打开系统就能看见完整国际贸易 ERP 的信息架构，而不只是扫码工具。",
          "库存和二维码统计后续仍必须来自真实状态，不能把 80 箱写死在页面或 AI 答案里。"
        ]}
      />

      <Card className="placeholder-card" style={{ marginTop: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div className="placeholder-meta">
            <span className="placeholder-icon">
              <ApiOutlined />
            </span>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                系统基础状态
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                这里展示服务连通、数据库初始化和默认演示场景配置，方便确认当前演示环境是否已经就绪。
              </Typography.Paragraph>
            </div>
          </div>

          <Space wrap>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              href="http://127.0.0.1:3001/api/setup/status"
              target="_blank"
            >
              查看系统状态
            </Button>
            <Button href="http://127.0.0.1:3001/api/health" target="_blank">
              查看服务状态
            </Button>
          </Space>
        </Space>
      </Card>
    </>
  );
}
