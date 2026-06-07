import { ApartmentOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function CompaniesPage() {
  return (
    <FeaturePlaceholder
      icon={<ApartmentOutlined />}
      title="多公司主体骨架"
      description="这里用于展示境内、香港、新加坡、赞比亚、刚果金等主体分工，让组织结构在演示时一眼可见。"
      badges={["组织结构", "职责分工", "权限隔离预告"]}
      bullets={[
        "后续会展示境内公司、香港公司、新加坡公司、赞比亚公司和刚果金公司的职责分工。",
        "第一版只做组织结构与职责说明，不做真实权限隔离与复杂授权逻辑。",
        "页面会明确提示正式版会按公司、国家和岗位做权限隔离。"
      ]}
    />
  );
}
