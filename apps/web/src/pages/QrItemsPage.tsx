import { QrcodeOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function QrItemsPage() {
  return (
    <FeaturePlaceholder
      icon={<QrcodeOutlined />}
      title="二维码管理骨架"
      description="为单个二维码货物的状态追踪、按批次筛选和二维码图片查看预留好页面位置。"
      badges={["二维码列表", "状态追踪", "导出预留"]}
      bullets={[
        "后续会显示二维码编号、批次号、合同号、商品名、仓库和状态。",
        "筛选条件将围绕批次、状态与仓库展开。",
        "二维码数量和库存状态都必须从真实数据推导，不能做静态写死。"
      ]}
    />
  );
}
