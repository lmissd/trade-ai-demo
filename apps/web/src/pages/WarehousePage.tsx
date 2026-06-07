import { InboxOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function WarehousePage() {
  return (
    <FeaturePlaceholder
      icon={<InboxOutlined />}
      title="仓储管理骨架"
      description="仓储模块会成为真实闭环的核心操作页，后续把预收货、扫码收货、库存管理和销售出库统一整合到这里。"
      badges={["预收货", "扫码收货", "库存管理", "销售出库"]}
      stats={[
        { label: "预收货管理", value: "待接入" },
        { label: "扫码收货验收", value: "待接入" },
        { label: "库存管理", value: "待接入" },
        { label: "销售出库管理", value: "待接入" }
      ]}
      bullets={[
        "后续这里会复用真实扫码入库、真实扫码出库和真实库存统计能力。",
        "旧的 /scan 和 /inventory 链接会自动兼容跳到这里，避免你原来的使用习惯断掉。",
        "仓储页是默认演示场景里最重要的操作区，库存剩余必须从真实二维码状态计算。"
      ]}
      mobileHint="双击 BAT 打开浏览器后，后续在手机浏览器访问这个模块即可直接进入扫码与库存主操作区。"
    />
  );
}
