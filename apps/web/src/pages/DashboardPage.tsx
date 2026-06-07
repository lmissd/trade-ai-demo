import { BarChartOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DashboardPage() {
  return (
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
  );
}
