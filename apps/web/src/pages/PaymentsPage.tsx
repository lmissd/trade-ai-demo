import { DollarCircleOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function PaymentsPage() {
  return (
    <FeaturePlaceholder
      icon={<DollarCircleOutlined />}
      title="回款记录骨架"
      description="阶段 1 预留回款记录列表和状态更新入口，为后续老板看板和 AI 问答提供财务侧基础信息。"
      badges={["应收金额", "回款状态", "财务占位"]}
      bullets={[
        "后续会展示合同编号、应收金额、已收金额、币种与回款状态。",
        "回款记录会参与首页未回款合同数量统计。",
        "第一版保持简单字段，暂不展开复杂财务流程。"
      ]}
    />
  );
}
