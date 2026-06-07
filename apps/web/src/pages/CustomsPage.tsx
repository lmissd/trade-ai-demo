import { SafetyCertificateOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function CustomsPage() {
  return (
    <FeaturePlaceholder
      icon={<SafetyCertificateOutlined />}
      title="报关清关骨架"
      description="这里用于展示清关工单、单据一致性检查和清关完成后的任务联动效果。"
      badges={["清关工单", "AI 单据检查", "联动仓库预收货"]}
      bullets={[
        "后续会展示清关工单号、责任公司、责任人、关联合同、关联批次和清关状态。",
        "详情页会展示箱单、发票、提单、产地证，以及 AI 一致性检查结果。",
        "第一版会提供“模拟清关完成”按钮，并生成境外陆运任务与仓库预收货工单。"
      ]}
    />
  );
}
