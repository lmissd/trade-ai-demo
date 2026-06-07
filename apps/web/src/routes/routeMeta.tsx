import type { ItemType } from "antd/es/menu/interface";
import type { ReactNode } from "react";
import {
  AppstoreOutlined,
  BarsOutlined,
  DeploymentUnitOutlined,
  DollarCircleOutlined,
  FileSearchOutlined,
  MessageOutlined,
  QrcodeOutlined,
  RadarChartOutlined,
  ScanOutlined
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
    title: "首页看板",
    subtitle: "汇总合同、批次、库存、回款与最新操作，方便演示时一眼看到全局状态。"
  },
  "/documents": {
    title: "单据上传",
    subtitle: "用于上传合同和箱单，并为后续 AI 识别与人工确认预留骨架。"
  },
  "/contracts": {
    title: "合同管理",
    subtitle: "展示合同列表与详情入口，为后续 AI 识别结果生成合同打基础。"
  },
  "/batches": {
    title: "批次管理",
    subtitle: "管理货物批次、数量、目的仓与二维码生成入口。"
  },
  "/qr-items": {
    title: "二维码管理",
    subtitle: "按批次与状态查看二维码货物，为后续追踪和导出做好结构预留。"
  },
  "/scan": {
    title: "手机扫码",
    subtitle: "为仓库人员预留移动端入库/出库骨架与后续扫码能力接入点。"
  },
  "/inventory": {
    title: "库存查询",
    subtitle: "将来基于真实二维码状态统计待入库、在库和已出库数量。"
  },
  "/payments": {
    title: "回款记录",
    subtitle: "记录合同回款状态，为老板视角的经营看板提供数据来源。"
  },
  "/ai-assistant": {
    title: "AI 问答",
    subtitle: "后续通过受控接口查询真实库存与回款数据，不允许写死答案。"
  }
};

export const routeMenuEntries: RouteMenuEntry[] = [
  { key: "/dashboard", icon: <AppstoreOutlined />, label: "首页看板" },
  { key: "/documents", icon: <FileSearchOutlined />, label: "单据上传" },
  { key: "/contracts", icon: <BarsOutlined />, label: "合同管理" },
  { key: "/batches", icon: <DeploymentUnitOutlined />, label: "批次管理" },
  { key: "/qr-items", icon: <QrcodeOutlined />, label: "二维码管理" },
  { key: "/scan", icon: <ScanOutlined />, label: "手机扫码" },
  { key: "/inventory", icon: <RadarChartOutlined />, label: "库存查询" },
  { key: "/payments", icon: <DollarCircleOutlined />, label: "回款记录" },
  { key: "/ai-assistant", icon: <MessageOutlined />, label: "AI 问答" }
];

export const routeMenuItems: ItemType[] = routeMenuEntries;
