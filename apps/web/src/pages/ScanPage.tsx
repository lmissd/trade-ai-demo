import { MobileOutlined, ScanOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function ScanPage() {
  return (
    <FeaturePlaceholder
      icon={<ScanOutlined />}
      title="移动扫码骨架"
      description="这个页面已经面向手机扫码场景预留好路由，后续会接入摄像头扫码、入库、出库与 Demo 辅助按钮。"
      badges={["移动端优先", "扫码入库", "扫码出库"]}
      bullets={[
        "扫码入库只允许处理待入库二维码，扫码出库只允许处理在库二维码。",
        "如果后续提供批量入库或批量出库按钮，数量必须读取当前批次或用户输入。",
        "同一二维码的生命周期将在扫码成功后实时驱动库存变化。"
      ]}
      mobileHint="建议后续在手机浏览器打开此页；阶段 1 先把移动端容器、布局与路由位固定下来。"
    />
  );
}
