import { RadarChartOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function InventoryPage() {
  return (
    <FeaturePlaceholder
      icon={<RadarChartOutlined />}
      title="库存查询骨架"
      description="阶段 1 先把库存展示与后续筛选区的位置搭起来，后面会按合同和批次接入真实汇总。"
      badges={["库存汇总", "按批次筛选", "按合同筛选"]}
      stats={[
        { label: "待入库", value: "待接入" },
        { label: "当前库存", value: "待接入" },
        { label: "已出库", value: "待接入" }
      ]}
      bullets={[
        "库存必须基于 QrItem 状态实时统计，不允许缓存固定 80 箱。",
        "后续会提供按批次和按合同的库存查询接口。",
        "这里也会展示入库与出库流水的时间、操作人与类型。"
      ]}
    />
  );
}
