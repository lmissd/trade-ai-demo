import { MessageOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function AiAssistantPage() {
  return (
    <FeaturePlaceholder
      icon={<MessageOutlined />}
      title="AI 问答骨架"
      description="后续这里会把老板提出的问题转成后端受控查询，再基于真实库存和回款结果生成自然语言回答。"
      badges={["AI 问答", "受控查询", "模板回答兜底"]}
      bullets={[
        "AI 不能直接查数据库，必须先识别意图，再走后端受控接口。",
        "默认场景里可以回答剩余 80 箱，但答案必须来自真实库存统计。",
        "后续会支持合同库存、批次库存、今日入库、今日出库和未回款合同等问题。"
      ]}
    />
  );
}
