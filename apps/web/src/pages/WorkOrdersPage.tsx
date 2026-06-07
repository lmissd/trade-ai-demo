import { SolutionOutlined } from "@ant-design/icons";
import { FeaturePlaceholder } from "../components/FeaturePlaceholder";

export function WorkOrdersPage() {
  return (
    <FeaturePlaceholder
      icon={<SolutionOutlined />}
      title="自动工单骨架"
      description="这里会展示采购跟进、国际运输安排、清关、预收货、出库和回款催收等跨模块工单。"
      badges={["自动生成", "任务提醒", "跨模块联动"]}
      bullets={[
        "后续会展示工单编号、任务内容、责任部门、责任人、截止时间、关联合同、关联批次和当前状态。",
        "第一版允许用固定模板模拟 AI 生成工单说明，但工单状态要能和业务状态联动。",
        "这个模块会把外围展示模块串成一条有推进感的 ERP 主线。"
      ]}
    />
  );
}
