import { ShoppingCartOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function ProcurementPage() {
  return (
    <FeaturePlaceholder
      icon={<ShoppingCartOutlined />}
      title="采购与境内集货骨架"
      description="这一页用于承接采购下单、供应商发货、国内集货和进入国际运输前的状态推进。"
      badges={["采购单列表", "状态推进", "联动物流"]}
      bullets={[
        "后续列表会展示采购单号、合同号、供应商、SKU、数量、交期、批次号和采购状态。",
        "详情抽屉会解释采购模块在完整 ERP 中的作用，并显示当前节点说明。",
        "第一版会提供“供应商已发货”和“国内集货完成”的模拟推进按钮。"
      ]}
    />
  );
}
