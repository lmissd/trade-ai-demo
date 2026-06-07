import { BarChartOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function CostsPage() {
  return (
    <FeaturePlaceholder
      icon={<BarChartOutlined />}
      title="成本利润骨架"
      description="这里会展示多币种采购、国际运费、清关费、仓储费和预计毛利，让 Demo 看起来更接近成熟 ERP。"
      badges={["多币种", "成本结构", "利润测算"]}
      bullets={[
        "后续会展示采购成本、国际运费、清关费、仓储费、本地配送费、杂费、总成本和销售金额。",
        "第一版允许使用固定演示数据，但页面必须明确标注为 Demo 数据。",
        "这个模块会帮助甲方理解系统不只是扫码库存，还能承接经营分析。"
      ]}
    />
  );
}
