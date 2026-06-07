import { FileSearchOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DocumentsPage() {
  return (
    <FeaturePlaceholder
      icon={<FileSearchOutlined />}
      title="合同与箱单上传骨架"
      description="这一页已经为文件上传、AI 识别结果展示、人工确认与字段修改预留了路由位置。"
      badges={["单据上传", "AI Mock", "人工确认"]}
      bullets={[
        "后续阶段会接入合同、箱单文件上传与历史记录列表。",
        "AI 返回的合同号、客户、商品、数量、金额等字段将在这里展示。",
        "商品、客户、供应商、仓库、数量、单位、金额、币种必须允许人工修改后再确认。"
      ]}
    />
  );
}
