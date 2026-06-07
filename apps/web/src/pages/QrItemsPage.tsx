import { QrcodeOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function QrItemsPage() {
  return (
    <FeaturePlaceholder
      icon={<QrcodeOutlined />}
      title="二维码追溯骨架"
      description="这里是核心真实闭环里最重要的追溯入口，后续会围绕真实二维码状态来驱动库存与 AI 回答。"
      badges={["二维码列表", "生命周期", "真实状态来源"]}
      bullets={[
        "后续会显示二维码编号、批次号、合同号、商品、仓库和当前生命周期状态。",
        "筛选条件将围绕批次、状态与仓库展开，并支持查看单个二维码图片。",
        "二维码数量和库存结果都必须从真实数据推导，不能在前端做静态写死。"
      ]}
    />
  );
}
