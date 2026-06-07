import { MessageOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function AiAssistantPage() {
  return (
    <FeaturePlaceholder
      icon={<MessageOutlined />}
      title="AI 助手骨架"
      description="这里会承接老板问答场景，先走后端受控查询，再结合真实库存和业务状态生成自然语言回答。"
      badges={["AI 问答", "受控查询", "模板兜底"]}
      bullets={[
        "AI 不能直接查数据库，必须先识别意图，再走后端受控接口。",
        "默认场景里可以回答剩余 80 箱，但答案必须来自真实二维码状态统计。",
        "后续会支持合同库存、批次库存、今日入库、今日出库和未回款合同等问题。"
      ]}
    />
  );
}
