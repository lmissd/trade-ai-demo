import { BarsOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function ContractsPage() {
  return (
    <FeaturePlaceholder
      icon={<BarsOutlined />}
      title="合同管理骨架"
      description="用于承接 AI 识别结果生成后的合同数据，也预留手动新增与详情页入口。"
      badges={["合同列表", "合同详情", "后续写入数据库"]}
      bullets={[
        "后续会展示合同编号、客户、供应商、商品、数量、单位、金额和目的地。",
        "合同写入必须经过用户确认和后端校验，AI 不能直接改数据库。",
        "这里会成为首页看板和 AI 问答的一个基础数据来源。"
      ]}
    />
  );
}
