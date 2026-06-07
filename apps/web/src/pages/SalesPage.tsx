import { CarOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function SalesPage() {
  return (
    <FeaturePlaceholder
      icon={<CarOutlined />}
      title="销售与配送骨架"
      description="这里用于展示销售单、境外配送状态、签收节点，以及与财务回款的联动关系。"
      badges={["销售单", "配送状态", "联动回款"]}
      bullets={[
        "后续列表会展示销售单号、客户、商品、销售数量、配送方式、配送状态和签收状态。",
        "详情抽屉会展示当前配送节点，以及模块在完整 ERP 中承担的职责。",
        "第一版会提供“模拟配送完成”按钮，并让财务模块进入待回款状态。"
      ]}
    />
  );
}
