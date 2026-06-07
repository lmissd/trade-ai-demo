import { DeploymentUnitOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function BatchesPage() {
  return (
    <FeaturePlaceholder
      icon={<DeploymentUnitOutlined />}
      title="批次管理骨架"
      description="用于管理合同下的货物批次，并为后续二维码生成、仓库流转和库存统计提供基础主线。"
      badges={["批次列表", "批次详情", "二维码入口"]}
      bullets={[
        "后续批次会携带商品名、总数量、单位、目的仓和状态。",
        "二维码生成必须基于当前批次数量动态生成，不允许固定写成 100。",
        "批次详情页会是后续进入二维码管理和扫码演示的重要入口。"
      ]}
    />
  );
}
