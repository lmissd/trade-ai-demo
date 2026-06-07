import { FileSearchOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function DocumentsPage() {
  return (
    <FeaturePlaceholder
      icon={<FileSearchOutlined />}
      title="合同与单据核心入口"
      description="这里将承接合同上传、箱单上传、AI Mock 识别、人工确认，以及后续合同与批次生成的真实闭环入口。"
      badges={["单据上传", "AI Mock", "合同/批次汇总"]}
      bullets={[
        "后续这里会整合上传记录、识别结果、合同列表和批次入口，不再把核心资料分散在多个旧菜单里。",
        "AI 返回的合同号、客户、商品、数量、金额、币种和目的仓信息将在这里展示。",
        "商品、客户、供应商、仓库、数量、单位、金额、币种必须允许人工修改后再确认写入。"
      ]}
    />
  );
}
