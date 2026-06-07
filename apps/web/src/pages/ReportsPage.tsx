import { ShopOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function ReportsPage() {
  return (
    <FeaturePlaceholder
      icon={<ShopOutlined />}
      title="数据报表骨架"
      description="这里会汇总采购、在途、库存、销售、回款、成本和利润卡片，让首页之外还有完整报表落点。"
      badges={["采购报表", "库存报表", "利润报表"]}
      bullets={[
        "后续会展示采购、在途、库存、销售、回款、成本、利润和二维码追溯等报表卡片。",
        "库存和二维码数据必须来自真实状态统计，成本利润可以先用固定演示数据。",
        "这个页面的作用是帮助甲方快速建立对系统经营视角的整体印象。"
      ]}
    />
  );
}
