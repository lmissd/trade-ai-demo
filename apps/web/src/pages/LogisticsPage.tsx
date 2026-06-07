import { GlobalOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function LogisticsPage() {
  return (
    <FeaturePlaceholder
      icon={<GlobalOutlined />}
      title="国际物流骨架"
      description="这里会展示运输批次、提单、柜号、起运与到港节点，帮助甲方看到完整国际运输链路。"
      badges={["运输批次", "时间轴", "到港触发清关"]}
      bullets={[
        "后续列表会展示运输批次号、船公司、提单号、柜号、起运港、目的港和运输状态。",
        "详情页会包含已装柜、已离港、海运中、到达目的港、待清关的时间轴。",
        "第一版会提供“模拟已离港”和“模拟到达目的港”的状态推进按钮。"
      ]}
    />
  );
}
