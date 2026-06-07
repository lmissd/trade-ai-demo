import { ApiOutlined, BarChartOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Button, Card, Space, Typography } from "antd";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DashboardPage() {
  return (
    <>
      <FeaturePlaceholder
        icon={<BarChartOutlined />}
        title="国际贸易 ERP 首页驾驶舱"
        description="这里是老板视角的总入口，用来串联核心真实闭环、外围成熟模块状态和当前演示环境的基础概览。"
        badges={["14 项 ERP 菜单", "老板视角入口", "双击 BAT 可预览"]}
        stats={[
          { label: "核心真实闭环", value: "8 步" },
          { label: "成熟展示模块", value: "10 个" },
          { label: "菜单入口", value: "14 页" },
          { label: "默认预览页", value: "/dashboard" }
        ]}
        bullets={[
          "后续这里会同时展示真实库存统计、二维码状态、工单提醒和外围模块推进状态。",
          "当前页面已经承担完整国际贸易 ERP Demo 的总入口角色，而不再只是临时骨架。",
          "库存和二维码相关数字后续仍必须来自真实状态统计，不能把 80 箱写死在页面或 AI 答案里。"
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
