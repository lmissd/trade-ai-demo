import { BarChartOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DashboardPage() {
  return (
    <FeaturePlaceholder
      icon={<BarChartOutlined />}
      title="老板视角总览骨架"
      description="阶段 1 先把看板入口和结构搭起来，后续阶段再接入合同、批次、库存、回款和扫码流水的真实统计。"
      badges={["Dashboard", "统计占位", "后续接真实数据"]}
      stats={[
        { label: "合同数量", value: "待接入" },
        { label: "批次数量", value: "待接入" },
        { label: "当前库存", value: "待接入" },
        { label: "未回款合同", value: "待接入" }
      ]}
      bullets={[
        "后续阶段会接入合同、批次、库存和回款汇总接口。",
        "最近扫码记录和最近上传单据区域将在真实业务数据完成后填充。",
        "库存数字必须基于真实二维码状态统计，不能写死默认演示值。"
      ]}
    />
  );
}
