import { DollarCircleOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function FinancePage() {
  return (
    <FeaturePlaceholder
      icon={<DollarCircleOutlined />}
      title="财务回款骨架"
      description="这里会承接合同应收、已收、账期、逾期和核销状态，让 ERP 演示链路在财务侧闭合。"
      badges={["应收", "部分回款", "核销状态"]}
      bullets={[
        "后续列表会展示合同号、应收金额、已收金额、币种、回款状态、账期、逾期状态和核销状态。",
        "旧的 /payments 链接会自动兼容跳到这里，保留原来的访问习惯。",
        "第一版会提供“模拟部分回款”和“模拟全部回款”按钮，不做真实财务凭证。"
      ]}
    />
  );
}
