import type { ItemType } from "antd/es/menu/interface";
import type { ReactNode } from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CarOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  InboxOutlined,
  QrcodeOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  SolutionOutlined
} from "@ant-design/icons";

export type RouteMeta = {
  title: string;
  subtitle: string;
};

type RouteMenuEntry = {
  key: string;
  icon: ReactNode;
  label: string;
};

export const routeMetaByPath: Record<string, RouteMeta> = {
  "/dashboard": {
    title: "首页驾驶舱",
    subtitle: "现在已经切换为老板视角总览，统一展示真实库存、执行进度、AI 状态与 ERP 模块概览。"
  },
  "/documents": {
    title: "合同与单据",
    subtitle: "承接单据上传、AI Mock 识别、人工修正，以及确认生成正式合同与批次。"
  },
  "/master-data": {
    title: "基础主数据",
    subtitle: "统一管理 SKU、客商、人员、车辆和司机等业务底座，后续正式流程都应引用这里的主数据编码。"
  },
  "/contracts": {
    title: "合同数据",
    subtitle: "查看由单据草稿确认生成的正式合同、合同明细、采购草稿与应收草稿。"
  },
  "/batches": {
    title: "批次追踪",
    subtitle: "批次是贯穿合同、采购、物流、清关、仓储、销售和库存的追踪线索，不作为独立业务处理模块。"
  },
  "/procurement": {
    title: "采购与集货",
    subtitle: "展示采购下单、供应商发货、国内集货和进入国际运输前的状态推进。"
  },
  "/logistics": {
    title: "国际物流",
    subtitle: "展示运输批次、提单、柜号、起运与到港节点，帮助演示完整国际运输链路。"
  },
  "/customs": {
    title: "报关清关",
    subtitle: "承接清关工单、单据一致性检查和清关完成后的后续任务联动。"
  },
  "/warehouse": {
    title: "仓储管理",
    subtitle: "预收货、扫码入库、扫码出库和库存真实统计已经统一收敛到这个核心真实工作台。"
  },
  "/sales": {
    title: "销售与配送",
    subtitle: "展示销售单、配送状态、签收节点，以及与财务回款状态的联动关系。"
  },
  "/finance": {
    title: "财务回款",
    subtitle: "展示应收、已收、账期、逾期和核销状态，承接演示版财务闭环。"
  },
  "/costs": {
    title: "成本利润",
    subtitle: "展示多币种采购、运费、清关费和利润测算，让 Demo 更像成熟 ERP。"
  },
  "/companies": {
    title: "多公司主体",
    subtitle: "展示境内、香港、新加坡、赞比亚、刚果金等主体分工与组织结构。"
  },
  "/work-orders": {
    title: "自动工单",
    subtitle: "展示采购、物流、清关、仓储、回款等跨模块任务的自动生成与提醒。"
  },
  "/reports": {
    title: "数据报表",
    subtitle: "展示采购、在途、库存、销售、回款、成本和利润的演示大盘入口。"
  },
  "/qr-items": {
    title: "二维码追溯",
    subtitle: "二维码生命周期、状态筛选与批次追溯都将从这里进入，库存统计必须依赖真实状态。"
  },
  "/materials": {
    title: "测试资料",
    subtitle: "集中浏览需求截图与测试单据，方便客户直接查看和上传。"
  },
  "/ai-assistant": {
    title: "AI 助手",
    subtitle: "老板提问后先走后端受控查询，再基于真实库存结果生成自然语言回答。"
  }
};

export const routeMenuEntries: RouteMenuEntry[] = [
  { key: "/dashboard", icon: <AppstoreOutlined />, label: "首页驾驶舱" },
  { key: "/documents", icon: <FileSearchOutlined />, label: "合同与单据" },
  { key: "/master-data", icon: <DatabaseOutlined />, label: "基础主数据" },
  { key: "/procurement", icon: <ShoppingCartOutlined />, label: "采购与集货" },
  { key: "/logistics", icon: <GlobalOutlined />, label: "国际物流" },
  { key: "/customs", icon: <SafetyCertificateOutlined />, label: "报关清关" },
  { key: "/warehouse", icon: <InboxOutlined />, label: "仓储管理" },
  { key: "/sales", icon: <CarOutlined />, label: "销售与配送" },
  { key: "/finance", icon: <DollarCircleOutlined />, label: "财务回款" },
  { key: "/costs", icon: <BarChartOutlined />, label: "成本利润" },
  { key: "/companies", icon: <ApartmentOutlined />, label: "多公司主体" },
  { key: "/work-orders", icon: <SolutionOutlined />, label: "自动工单" },
  { key: "/reports", icon: <ShopOutlined />, label: "数据报表" },
  { key: "/qr-items", icon: <QrcodeOutlined />, label: "二维码追溯" }
  ,
  { key: "/materials", icon: <FileSearchOutlined />, label: "测试资料" }
];

export const routeMenuItems: ItemType[] = routeMenuEntries;
