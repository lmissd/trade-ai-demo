import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CameraOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ScanOutlined,
  StopOutlined
} from "@ant-design/icons";
import { Html5Qrcode } from "html5-qrcode";
import { WarehouseInventorySection, type InventorySummaryResponse } from "../components/WarehouseInventorySection";
import { requestJson } from "../lib/api";

type ScanMode = "INBOUND" | "OUTBOUND";

type WarehouseTabKey = "preReceive" | "scanInbound" | "inventory" | "outbound";

type WarehouseContext = {
  mode: ScanMode;
  task: {
    id: string;
    taskNo: string;
    orderNo: string;
    type: string;
    status: string;
    appointmentNo: string | null;
    appointmentTime: string | null;
    waveNo: string | null;
    dockNo: string | null;
    arrivalStatus: string | null;
    pickupListNo: string | null;
    reviewStatus: string | null;
    firstReviewerName: string | null;
    firstReviewedAt: string | null;
    secondReviewerName: string | null;
    secondReviewedAt: string | null;
    pickingStatus: string | null;
  };
  batch: {
    id: string;
    batchNo: string;
    status: string;
    totalQuantity: number;
    unit: string;
    productName: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
  };
  warehouse: {
    id: string;
    warehouseCode: string;
    name: string;
    country: string;
    city: string | null;
    locationId: string | null;
    locationCode: string | null;
  };
  quantities: {
    target: number;
    scanned: number;
    remaining: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
    frozen: number;
  };
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
    damaged: number;
    lost: number;
    frozen: number;
  };
  hierarchySummary: {
    unitCount: number;
    boxCount: number;
    palletCount: number;
  };
  locations: Array<{
    id: string;
    locationCode: string;
    zone: string | null;
    status: string;
  }>;
  recentScanRecords: Array<{
    id: string;
    qrCode: string;
    productName: string | null;
    movementType: string;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    operatorName: string | null;
    occurredAt: string;
    note: string | null;
    remark: string | null;
  }>;
};

type ScanPreview = {
  operationType: ScanMode;
  qrItemId: string;
  qrCode: string;
  productName: string | null;
  contractId: string;
  contractNo: string;
  batchId: string;
  batchNo: string;
  currentStatus: string;
  currentStatusLabel: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string | null;
  locationCode: string | null;
  taskId: string;
  taskNo: string;
  orderNo: string;
  quantityContext: {
    target: number;
    unit: string;
  };
  summary: {
    operatorStep: string;
    message: string;
  };
};

type ScanConfirmResponse = {
  success: boolean;
  message: string;
  qrItem: {
    id: string;
    qrCode: string;
    status: string;
    inboundAt: string | null;
    outboundAt: string | null;
  };
  context: WarehouseContext;
};

type BulkScanResponse = {
  success: boolean;
  processed: number;
  requested: number;
  failures: Array<{
    qrCode: string;
    message: string;
  }>;
  items: Array<{
    qrCode: string;
    status: string;
  }>;
  context: WarehouseContext;
};

type ExceptionRecord = {
  id: string;
  qrCode: string;
  message: string;
  mode: ScanMode;
  createdAt: string;
};

type WarehouseQrRecord = {
  id: string;
  qrCode: string;
  serialNo: number;
  status: string;
  unitTraceCode: string | null;
  boxTraceCode: string | null;
  palletTraceCode: string | null;
  freezeReason: string | null;
  statusRemark: string | null;
  productName: string | null;
  currentWarehouse: string | null;
  createdAt: string;
  updatedAt: string;
};

type WarehouseAnomalyRow = {
  id: string;
  anomalyNo: string;
  mode: "INBOUND" | "OUTBOUND" | "INVENTORY";
  anomalyType: string;
  batchId: string | null;
  batchNo: string;
  contractId: string | null;
  contractNo: string;
  warehouseId: string | null;
  warehouseName: string;
  relatedOrderId: string | null;
  relatedOrderNo: string | null;
  qrCode: string | null;
  quantity: number;
  description: string | null;
  status: string;
  reportedByName: string | null;
  handledByName: string | null;
  reportedAt: string;
  handledAt: string | null;
};

type WarehouseStocktakeRow = {
  id: string;
  stocktakeNo: string;
  warehouseId: string | null;
  warehouseName: string;
  batchId: string | null;
  batchNo: string;
  contractId: string | null;
  contractNo: string;
  status: string;
  plannedQuantity: number;
  actualQuantity: number;
  differenceQuantity: number;
  note: string | null;
  operatorName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

type WarehouseWorkbenchResponse = {
  generatedAt: string;
  focus: {
    batchId: string;
    batchNo: string;
    contractId: string;
    contractNo: string;
    warehouseId: string;
    warehouseName: string;
  };
  summary: {
    preReceiveTotal: number;
    preReceiveReady: number;
    preReceiveInProgress: number;
    preReceiveCompleted: number;
    outboundTotal: number;
    outboundReady: number;
    outboundInProgress: number;
    outboundCompleted: number;
    pendingInboundQrCount: number;
    inStockQrCount: number;
    outboundQrCount: number;
    frozenQrCount: number;
    openAnomalyCount: number;
    stocktakePendingCount: number;
    warehouseCount: number;
  };
  preReceiveOrders: PreReceiveRow[];
  outboundOrders: OutboundRow[];
  anomalies: WarehouseAnomalyRow[];
  stocktakes: WarehouseStocktakeRow[];
  locationSnapshots: Array<{
    id: string;
    warehouseId: string | null;
    warehouseName: string;
    locationCode: string;
    zone: string | null;
    status: string;
    isFocusWarehouse: boolean;
    isSuggestedForInbound: boolean;
    isSuggestedForOutbound: boolean;
  }>;
};

type PreReceiveRow = {
  id: string;
  preReceiveNo: string;
  appointmentNo: string | null;
  appointmentTime: string | null;
  expectedArrivalTime: string | null;
  waveNo: string | null;
  dockNo: string | null;
  arrivalStatus: string | null;
  skuName: string;
  quantity: number;
  unit: string;
  suggestedLocation: string | null;
  status: string;
  batchId: string | null;
  batchNo: string;
  batchStatus: string | null;
  contractId: string | null;
  contractNo: string;
  warehouseId: string | null;
  warehouseName: string;
  inboundNo: string;
  scannedQuantity: number;
  remainingQuantity: number;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
    frozen: number;
    damaged: number;
    lost: number;
  };
  updatedAt: string;
};

type OutboundRow = {
  id: string;
  outboundNo: string;
  status: string;
  waveNo: string | null;
  pickupListNo: string | null;
  reviewStatus: string | null;
  firstReviewerName: string | null;
  firstReviewedAt: string | null;
  secondReviewerName: string | null;
  secondReviewedAt: string | null;
  pickingStatus: string | null;
  quantity: number;
  unit: string;
  batchId: string | null;
  batchNo: string;
  batchStatus: string | null;
  contractId: string | null;
  contractNo: string;
  warehouseId: string | null;
  warehouseName: string;
  salesOrderId: string | null;
  salesNo: string;
  customerName: string;
  skuName: string;
  deliveryMethod: string | null;
  deliveryStatus: string | null;
  signStatus: string | null;
  scannedQuantity: number;
  remainingQuantity: number;
  inStockAvailable: number;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
    frozen: number;
    damaged: number;
    lost: number;
  };
  updatedAt: string;
};

type WarehouseWorkbenchEnvelope = {
  workbench: WarehouseWorkbenchResponse;
};

type InventoryEnvelope = {
  inventory: InventorySummaryResponse;
};

const anomalyModeOptions = [
  { label: "入库异常", value: "INBOUND" },
  { label: "出库异常", value: "OUTBOUND" },
  { label: "库存异常", value: "INVENTORY" }
] as const;

const anomalyTypeOptions = [
  { label: "错货", value: "WRONG_GOODS" },
  { label: "漏扫", value: "MISSING_SCAN" },
  { label: "多扫", value: "EXTRA_SCAN" },
  { label: "破损", value: "DAMAGED" },
  { label: "少件", value: "SHORTAGE" },
  { label: "多件", value: "OVERAGE" },
  { label: "错批次", value: "WRONG_BATCH" },
  { label: "错任务", value: "WRONG_TASK" }
] as const;

const defaultAnomalyDraft = {
  mode: "INBOUND" as WarehouseAnomalyRow["mode"],
  anomalyType: "WRONG_GOODS",
  quantity: 1,
  qrCode: "",
  description: ""
};

const qrStatusColorMap: Record<string, string> = {
  PENDING_INBOUND: "processing",
  IN_STOCK: "success",
  OUTBOUND: "default",
  DAMAGED: "error",
  LOST: "error",
  FROZEN: "warning"
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getOperationMeta(mode: ScanMode) {
  return mode === "INBOUND"
    ? {
        title: "扫码收货验收",
        titleTag: "入库模式",
        note: "当前区域只允许处理待入库二维码，扫到其他状态、其他批次或其他任务的货物都会被拦截。",
        buttonText: "确认入库",
        successText: "入库已确认",
        color: "processing" as const
      }
    : {
        title: "销售出库扫码",
        titleTag: "出库模式",
        note: "当前区域只允许处理已在库二维码，未入库、已出库、冻结或异常状态都会被拒绝。",
        buttonText: "确认出库",
        successText: "出库已确认",
        color: "volcano" as const
      };
}

function getStatusColor(status?: string | null) {
  if (!status) {
    return "default";
  }

  if (status === "COMPLETED") {
    return "success";
  }

  if (status === "IN_PROGRESS") {
    return "processing";
  }

  if (status === "READY" || status === "PENDING") {
    return "gold";
  }

  return "default";
}

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState<WarehouseTabKey>("preReceive");
  const [mode, setMode] = useState<ScanMode>("INBOUND");
  const [contextByMode, setContextByMode] = useState<Partial<Record<ScanMode, WarehouseContext>>>({});
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);
  const [exceptionRecords, setExceptionRecords] = useState<ExceptionRecord[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryResponse | null>(null);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [workbench, setWorkbench] = useState<WarehouseWorkbenchResponse | null>(null);
  const [isWorkbenchLoading, setIsWorkbenchLoading] = useState(false);
  const [selectedPreReceiveId, setSelectedPreReceiveId] = useState<string | null>(null);
  const [selectedOutboundId, setSelectedOutboundId] = useState<string | null>(null);
  const [focusQrItems, setFocusQrItems] = useState<WarehouseQrRecord[]>([]);
  const [isFocusQrItemsLoading, setIsFocusQrItemsLoading] = useState(false);
  const [selectedQrItemId, setSelectedQrItemId] = useState<string | null>(null);
  const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);
  const [isSubmittingAnomaly, setIsSubmittingAnomaly] = useState(false);
  const [anomalyDraft, setAnomalyDraft] = useState({ ...defaultAnomalyDraft });
  const [stocktakeActualQuantity, setStocktakeActualQuantity] = useState<number | null>(null);
  const [stocktakeNote, setStocktakeNote] = useState("");
  const [isStocktakeSubmitting, setIsStocktakeSubmitting] = useState(false);
  const [selectedStocktakeId, setSelectedStocktakeId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = "warehouse-camera-scanner";

  const currentContext = contextByMode[mode] ?? null;
  const currentMeta = getOperationMeta(mode);

  const selectedPreReceive = useMemo(() => {
    if (!workbench?.preReceiveOrders.length) {
      return null;
    }

    return workbench.preReceiveOrders.find((item) => item.id === selectedPreReceiveId) ?? workbench.preReceiveOrders[0];
  }, [workbench, selectedPreReceiveId]);

  const selectedOutbound = useMemo(() => {
    if (!workbench?.outboundOrders.length) {
      return null;
    }

    return workbench.outboundOrders.find((item) => item.id === selectedOutboundId) ?? workbench.outboundOrders[0];
  }, [workbench, selectedOutboundId]);

  const focusLocations = useMemo(
    () => (workbench?.locationSnapshots ?? []).filter((item) => item.isFocusWarehouse),
    [workbench]
  );

  const selectedFocusQrItem = useMemo(
    () => focusQrItems.find((item) => item.id === selectedQrItemId) ?? focusQrItems[0] ?? null,
    [focusQrItems, selectedQrItemId]
  );

  const selectedWorkbenchStocktake = useMemo(
    () => workbench?.stocktakes.find((item) => item.id === selectedStocktakeId) ?? null,
    [workbench, selectedStocktakeId]
  );

  const locationOptions = useMemo(
    () =>
      (currentContext?.locations ?? []).map((location) => ({
        label: `${location.locationCode}${location.zone ? ` · ${location.zone}` : ""}`,
        value: location.id
      })),
    [currentContext]
  );

  const preReceiveColumns: ColumnsType<PreReceiveRow> = [
    {
      title: "预收货单号",
      dataIndex: "preReceiveNo",
      width: 190
    },
    {
      title: "关联合同 / 批次",
      key: "businessNo",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.contractNo}</div>
          <div className="documents-secondary-text">{record.batchNo}</div>
        </div>
      )
    },
    {
      title: "SKU / 数量",
      key: "skuQuantity",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.skuName}</div>
          <div className="documents-secondary-text">
            {record.quantity}
            {record.unit} · 已扫 {record.scannedQuantity}
          </div>
        </div>
      )
    },
    {
      title: "预约 / 波次 / 月台",
      key: "appointment",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.appointmentNo ?? "-"}</div>
          <div className="documents-secondary-text">
            {record.waveNo ?? "-"} · {record.dockNo ?? "-"}
          </div>
        </div>
      )
    },
    {
      title: "预计到仓",
      dataIndex: "expectedArrivalTime",
      width: 180,
      render: (value: string | null) => formatDateTime(value)
    },
    {
      title: "建议库位",
      dataIndex: "suggestedLocation",
      width: 140,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={getStatusColor(value)}>{value}</Tag>
    },
    {
      title: "到仓状态",
      dataIndex: "arrivalStatus",
      width: 120,
      render: (value: string | null) => <Tag color={getStatusColor(value)}>{value ?? "-"}</Tag>
    }
  ];

  const outboundColumns: ColumnsType<OutboundRow> = [
    {
      title: "出库单号",
      dataIndex: "outboundNo",
      width: 190
    },
    {
      title: "销售单 / 客户",
      key: "sales",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.salesNo}</div>
          <div className="documents-secondary-text">{record.customerName}</div>
        </div>
      )
    },
    {
      title: "关联合同 / 批次",
      key: "businessNo",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.contractNo}</div>
          <div className="documents-secondary-text">{record.batchNo}</div>
        </div>
      )
    },
    {
      title: "商品 / 数量",
      key: "skuQuantity",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.skuName}</div>
          <div className="documents-secondary-text">
            {record.quantity}
            {record.unit} · 已扫 {record.scannedQuantity}
          </div>
        </div>
      )
    },
    {
      title: "波次 / 提货清单",
      key: "wave",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.waveNo ?? "-"}</div>
          <div className="documents-secondary-text">{record.pickupListNo ?? "-"}</div>
        </div>
      )
    },
    {
      title: "在库可扫",
      dataIndex: "inStockAvailable",
      width: 110
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={getStatusColor(value)}>{value}</Tag>
    },
    {
      title: "复核",
      key: "reviewStatus",
      width: 150,
      render: (_, record) => <Tag color={getStatusColor(record.reviewStatus)}>{record.reviewStatus ?? "-"}</Tag>
    }
  ];

  const recentColumns: ColumnsType<WarehouseContext["recentScanRecords"][number]> = [
    {
      title: "二维码",
      dataIndex: "qrCode",
      width: 180
    },
    {
      title: "动作",
      dataIndex: "movementType",
      width: 110,
      render: (value: string) => <Tag color={value === "INBOUND" ? "processing" : "volcano"}>{value}</Tag>
    },
    {
      title: "状态变化",
      key: "statusChange",
      width: 180,
      render: (_, record) => `${record.fromStatus ?? "-"} -> ${record.toStatus ?? "-"}`
    },
    {
      title: "操作时间",
      dataIndex: "occurredAt",
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: "备注",
      key: "remark",
      render: (_, record) => record.remark ?? record.note ?? "-"
    }
  ];

  const exceptionColumns: ColumnsType<ExceptionRecord> = [
    {
      title: "异常时间",
      dataIndex: "createdAt",
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: "操作",
      dataIndex: "mode",
      width: 110,
      render: (value: ScanMode) => <Tag color={value === "INBOUND" ? "processing" : "volcano"}>{value}</Tag>
    },
    {
      title: "二维码",
      dataIndex: "qrCode",
      width: 180
    },
    {
      title: "异常原因",
      dataIndex: "message"
    }
  ];

  const focusQrColumns: ColumnsType<WarehouseQrRecord> = [
    {
      title: "二维码",
      dataIndex: "qrCode",
      width: 220
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={qrStatusColorMap[value] ?? "default"}>{value}</Tag>
    },
    {
      title: "箱码 / 托盘码",
      key: "trace",
      width: 260,
      render: (_, record) => (
        <div>
          <div>{record.boxTraceCode ?? "-"}</div>
          <div className="documents-secondary-text">{record.palletTraceCode ?? "-"}</div>
        </div>
      )
    },
    {
      title: "冻结原因 / 备注",
      key: "freeze",
      render: (_, record) => record.freezeReason ?? record.statusRemark ?? "-"
    }
  ];

  const anomalyColumns: ColumnsType<WarehouseAnomalyRow> = [
    {
      title: "异常单号",
      dataIndex: "anomalyNo",
      width: 180
    },
    {
      title: "类型",
      key: "type",
      width: 200,
      render: (_, record) => (
        <div>
          <div>{record.mode}</div>
          <div className="documents-secondary-text">{record.anomalyType}</div>
        </div>
      )
    },
    {
      title: "关联合同 / 批次",
      key: "business",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.contractNo}</div>
          <div className="documents-secondary-text">{record.batchNo}</div>
        </div>
      )
    },
    {
      title: "异常说明",
      dataIndex: "description"
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={getStatusColor(value)}>{value}</Tag>
    }
  ];

  const workbenchStocktakeColumns: ColumnsType<WarehouseStocktakeRow> = [
    {
      title: "盘点单号",
      dataIndex: "stocktakeNo",
      width: 180
    },
    {
      title: "批次 / 仓库",
      key: "scope",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.batchNo}</div>
          <div className="documents-secondary-text">{record.warehouseName}</div>
        </div>
      )
    },
    {
      title: "计划 / 实盘 / 差异",
      key: "count",
      width: 180,
      render: (_, record) => `${record.plannedQuantity} / ${record.actualQuantity} / ${record.differenceQuantity}`
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={getStatusColor(value)}>{value}</Tag>
    },
    {
      title: "完成时间",
      dataIndex: "completedAt",
      width: 180,
      render: (value: string | null) => formatDateTime(value)
    }
  ];

  async function loadInventorySummary() {
    setIsInventoryLoading(true);

    try {
      const summary = await requestJson<InventorySummaryResponse>("/api/inventory/summary");
      setInventorySummary(summary);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载库存真实统计失败。");
    } finally {
      setIsInventoryLoading(false);
    }
  }

  async function loadWarehouseWorkbench(batchId?: string) {
    setIsWorkbenchLoading(true);

    try {
      const query = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
      const nextWorkbench = await requestJson<WarehouseWorkbenchResponse>(`/api/warehouse/workbench${query}`);
      setWorkbench(nextWorkbench);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载仓储工作台失败。");
    } finally {
      setIsWorkbenchLoading(false);
    }
  }

  async function loadFocusQrItems(batchId?: string) {
    setIsFocusQrItemsLoading(true);

    try {
      const resolvedBatchId = batchId ?? currentContext?.batch.id ?? workbench?.focus.batchId ?? null;

      if (!resolvedBatchId) {
        setFocusQrItems([]);
        setSelectedQrItemId(null);
        return;
      }

      const items = await requestJson<WarehouseQrRecord[]>(
        `/api/qr-items?batchId=${encodeURIComponent(resolvedBatchId)}`
      );
      setFocusQrItems(items);
      setSelectedQrItemId((previous) => previous ?? items[0]?.id ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载批次二维码失败。");
    } finally {
      setIsFocusQrItemsLoading(false);
    }
  }

  async function loadContext(nextMode: ScanMode, batchId?: string) {
    setIsContextLoading(true);

    try {
      const nextContext = await requestJson<WarehouseContext>("/api/warehouse/scan/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: nextMode,
          batchId
        })
      });

      setContextByMode((previous) => ({
        ...previous,
        [nextMode]: nextContext
      }));

      if (nextMode === mode) {
        setSelectedLocationId(nextContext.warehouse.locationId ?? nextContext.locations[0]?.id);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载仓储任务失败。");
    } finally {
      setIsContextLoading(false);
    }
  }

  async function refreshWarehouseWorkspace(batchId?: string) {
    await Promise.all([
      loadContext("INBOUND", batchId),
      loadContext("OUTBOUND", batchId),
      loadInventorySummary(),
      loadWarehouseWorkbench(batchId),
      loadFocusQrItems(batchId)
    ]);
  }

  async function reportAnomaly() {
    const focusBatchId = currentContext?.batch.id ?? workbench?.focus.batchId ?? null;
    const focusContractId = currentContext?.contract.id ?? workbench?.focus.contractId ?? null;
    const focusWarehouseId = currentContext?.warehouse.id ?? workbench?.focus.warehouseId ?? null;
    const relatedOrderId = currentContext?.task.id ?? null;
    const relatedOrderNo = currentContext?.task.taskNo ?? null;

    if (!focusBatchId || !focusContractId || !focusWarehouseId) {
      message.warning("当前缺少仓储上下文，暂时无法上报异常。");
      return;
    }

    setIsSubmittingAnomaly(true);

    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope>("/api/warehouse/anomalies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: anomalyDraft.mode,
          anomalyType: anomalyDraft.anomalyType,
          batchId: focusBatchId,
          contractId: focusContractId,
          warehouseId: focusWarehouseId,
          relatedOrderId,
          relatedOrderNo,
          qrCode: anomalyDraft.qrCode.trim() || undefined,
          quantity: anomalyDraft.quantity,
          description: anomalyDraft.description.trim() || undefined
        })
      });

      setWorkbench(result.workbench);
      setIsAnomalyModalOpen(false);
      setAnomalyDraft({ ...defaultAnomalyDraft });
      message.success("仓储异常已上报。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上报仓储异常失败。");
    } finally {
      setIsSubmittingAnomaly(false);
    }
  }

  async function handleAnomaly(anomalyId: string) {
    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope>(`/api/warehouse/anomalies/${anomalyId}/handle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "RESOLVED",
          resolution: "已在工作台中人工处理并关闭。"
        })
      });

      setWorkbench(result.workbench);
      message.success("异常已处理。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "处理异常失败。");
    }
  }

  async function toggleFreezeQrItem(qrItemId: string, nextAction: "freeze" | "unfreeze") {
    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope & InventoryEnvelope>(
        `/api/warehouse/qr-items/${qrItemId}/${nextAction}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body:
            nextAction === "freeze"
              ? JSON.stringify({
                  reason: "阶段23演示冻结",
                  remark: "仓储执行深化演示：人工冻结库存"
                })
              : JSON.stringify({
                  remark: "仓储执行深化演示：人工解冻库存"
                })
        }
      );

      setWorkbench(result.workbench);
      setInventorySummary(result.inventory);
      await loadFocusQrItems(currentContext?.batch.id ?? workbench?.focus.batchId);
      message.success(nextAction === "freeze" ? "二维码已冻结。" : "二维码已解冻。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切换二维码冻结状态失败。");
    }
  }

  async function createStocktake() {
    const focusBatchId = currentContext?.batch.id ?? workbench?.focus.batchId ?? null;
    const focusContractId = currentContext?.contract.id ?? workbench?.focus.contractId ?? null;
    const focusWarehouseId = currentContext?.warehouse.id ?? workbench?.focus.warehouseId ?? null;

    if (!focusBatchId || !focusContractId || !focusWarehouseId) {
      message.warning("当前缺少盘点所需的批次、合同或仓库上下文。");
      return;
    }

    setIsStocktakeSubmitting(true);

    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope & InventoryEnvelope>("/api/warehouse/stocktakes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          batchId: focusBatchId,
          contractId: focusContractId,
          warehouseId: focusWarehouseId,
          note: stocktakeNote.trim() || "阶段23演示盘点任务"
        })
      });

      setWorkbench(result.workbench);
      setInventorySummary(result.inventory);
      setStocktakeNote("");
      message.success("盘点任务已创建。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建盘点任务失败。");
    } finally {
      setIsStocktakeSubmitting(false);
    }
  }

  async function completeStocktake(stocktakeId: string) {
    if (stocktakeActualQuantity === null) {
      message.warning("请先填写实际盘点数量。");
      return;
    }

    setIsStocktakeSubmitting(true);

    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope & InventoryEnvelope>(
        `/api/warehouse/stocktakes/${stocktakeId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            actualQuantity: stocktakeActualQuantity,
            note: stocktakeNote.trim() || "阶段23演示盘点完成"
          })
        }
      );

      setWorkbench(result.workbench);
      setInventorySummary(result.inventory);
      setStocktakeActualQuantity(null);
      setStocktakeNote("");
      setSelectedStocktakeId(null);
      message.success("盘点任务已完成。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "完成盘点任务失败。");
    } finally {
      setIsStocktakeSubmitting(false);
    }
  }

  async function advanceReview(outboundOrderId: string, reviewStep: "first" | "second") {
    try {
      const result = await requestJson<WarehouseWorkbenchEnvelope>(
        `/api/warehouse/outbound-orders/${outboundOrderId}/${reviewStep}-review`,
        {
          method: "POST"
        }
      );

      setWorkbench(result.workbench);
      message.success(reviewStep === "first" ? "出库一审已完成。" : "出库二审已完成。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推进出库复核失败。");
    }
  }

  function pushExceptionRecord(qrCode: string, errorMessage: string, operationMode: ScanMode) {
    setExceptionRecords((previous) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        qrCode,
        message: errorMessage,
        mode: operationMode,
        createdAt: new Date().toISOString()
      },
      ...previous
    ]);
  }

  async function previewScan(qrCodeInput: string, operationMode: ScanMode) {
    const qrCode = qrCodeInput.trim();
    const operationContext = contextByMode[operationMode] ?? null;

    if (!operationContext) {
      message.warning("当前仓储任务还未加载完成。");
      return;
    }

    if (!qrCode) {
      message.warning("请先输入或扫描二维码。");
      return;
    }

    setMode(operationMode);
    setIsPreviewLoading(true);

    try {
      const nextPreview = await requestJson<ScanPreview>("/api/warehouse/scan/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: operationMode,
          qrCode,
          batchId: operationContext.batch.id,
          taskId: operationContext.task.id,
          contractId: operationContext.contract.id,
          warehouseId: operationContext.warehouse.id,
          locationId: selectedLocationId ?? operationContext.warehouse.locationId
        })
      });

      setPreview(nextPreview);
      setIsPreviewVisible(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "扫码预检失败。";
      pushExceptionRecord(qrCode, errorMessage, operationMode);
      message.error(errorMessage);
    } finally {
      setIsPreviewLoading(false);
      setManualCode("");
    }
  }

  async function confirmScan() {
    if (!preview) {
      return;
    }

    const operationMode = preview.operationType;
    const operationContext = contextByMode[operationMode] ?? null;
    const operationMeta = getOperationMeta(operationMode);

    if (!operationContext) {
      message.warning("当前仓储任务还未加载完成。");
      return;
    }

    setIsConfirming(true);

    try {
      const result = await requestJson<ScanConfirmResponse>("/api/warehouse/scan/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: operationMode,
          qrItemId: preview.qrItemId,
          batchId: operationContext.batch.id,
          taskId: operationContext.task.id,
          contractId: operationContext.contract.id,
          warehouseId: operationContext.warehouse.id,
          locationId: preview.locationId ?? selectedLocationId ?? operationContext.warehouse.locationId
        })
      });

      setContextByMode((previous) => ({
        ...previous,
        [operationMode]: result.context
      }));

      await refreshWarehouseWorkspace(operationContext.batch.id);
      setLastSuccessMessage(`${operationMeta.successText}：${result.qrItem.qrCode}`);
      setIsPreviewVisible(false);
      setPreview(null);
      message.success(result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "确认扫码失败。";
      pushExceptionRecord(preview.qrCode, errorMessage, operationMode);
      message.error(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  }

  async function runBulkAction(quantity: number, operationMode: ScanMode) {
    const operationContext = contextByMode[operationMode] ?? null;

    if (!operationContext) {
      message.warning("当前仓储任务还未加载完成。");
      return;
    }

    setMode(operationMode);
    setIsBulkRunning(true);

    try {
      const result = await requestJson<BulkScanResponse>("/api/warehouse/scan/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: operationMode,
          batchId: operationContext.batch.id,
          taskId: operationContext.task.id,
          contractId: operationContext.contract.id,
          warehouseId: operationContext.warehouse.id,
          locationId: selectedLocationId ?? operationContext.warehouse.locationId,
          quantity
        })
      });

      setContextByMode((previous) => ({
        ...previous,
        [operationMode]: result.context
      }));

      await refreshWarehouseWorkspace(operationContext.batch.id);

      if (result.failures.length > 0) {
        setExceptionRecords((previous) => [
          ...result.failures.map((failure, index) => ({
            id: `${Date.now()}-${index}-${failure.qrCode}`,
            qrCode: failure.qrCode,
            message: failure.message,
            mode: operationMode,
            createdAt: new Date().toISOString()
          })),
          ...previous
        ]);
      }

      message.success(`已处理 ${result.processed} 个二维码。`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "批量辅助执行失败。");
    } finally {
      setIsBulkRunning(false);
    }
  }

  async function startCameraScanner() {
    if (cameraBusy || cameraEnabled) {
      return;
    }

    setCameraBusy(true);

    try {
      const scanner = new Html5Qrcode(scannerRegionId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        (decodedText) => {
          void previewScan(decodedText, mode);
        },
        () => {
          // Ignore noisy scan errors from the camera loop.
        }
      );

      setCameraEnabled(true);
      message.success("摄像头扫码已开启。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法开启摄像头扫码。");
      scannerRef.current = null;
    } finally {
      setCameraBusy(false);
    }
  }

  async function stopCameraScanner() {
    if (!scannerRef.current) {
      setCameraEnabled(false);
      return;
    }

    setCameraBusy(true);

    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
      scannerRef.current = null;
      setCameraEnabled(false);
      message.info("摄像头扫码已关闭。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "关闭摄像头扫码失败。");
    } finally {
      setCameraBusy(false);
    }
  }

  function openInboundConsole(row?: PreReceiveRow | null) {
    setMode("INBOUND");
    setActiveTab("scanInbound");

    if (row?.batchId) {
      void refreshWarehouseWorkspace(row.batchId);
    }
  }

  function openOutboundConsole(row?: OutboundRow | null) {
    setMode("OUTBOUND");
    setActiveTab("outbound");

    if (row?.batchId) {
      void refreshWarehouseWorkspace(row.batchId);
    }
  }

  function handleTabChange(nextTab: string) {
    const key = nextTab as WarehouseTabKey;

    if (cameraEnabled && key !== activeTab) {
      void stopCameraScanner();
    }

    setActiveTab(key);

    if (key === "scanInbound") {
      setMode("INBOUND");
    } else if (key === "outbound") {
      setMode("OUTBOUND");
    }
  }

  function renderScanSection(operationMode: ScanMode) {
    const operationContext = contextByMode[operationMode] ?? null;
    const operationMeta = getOperationMeta(operationMode);
    const operationExceptions = exceptionRecords.filter((item) => item.mode === operationMode);

    return (
      <div className="warehouse-scan-section">
        <Alert
          type={operationMode === "INBOUND" ? "info" : "warning"}
          showIcon
          message={operationMeta.note}
          description="扫码成功不等于业务成功，只有‘扫码命中 + 校验通过 + 人工确认’后，系统才会真正更新 QrItem 和库存流水。"
        />

        {operationContext?.qrSummary.total === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="当前批次还没有可扫码二维码"
            description="这说明正式业务数据已经进入仓储环节，但本批次尚未执行二维码生成。你现在可以先查看预收货 / 出库任务与库存口径，等阶段 5 的二维码生成链路跑完后，这里才会真正进入扫码执行。"
          />
        ) : null}

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={9}>
            <div className="document-summary-grid warehouse-summary-grid">
              <Card className="stat-card">
                <Statistic
                  title="应扫数量"
                  value={operationContext?.quantities.target ?? 0}
                  suffix={operationContext?.batch.unit ?? "箱"}
                />
              </Card>
              <Card className="stat-card">
                <Statistic
                  title="已扫数量"
                  value={operationContext?.quantities.scanned ?? 0}
                  suffix={operationContext?.batch.unit ?? "箱"}
                />
              </Card>
              <Card className="stat-card">
                <Statistic
                  title="剩余数量"
                  value={operationContext?.quantities.remaining ?? 0}
                  suffix={operationContext?.batch.unit ?? "箱"}
                />
              </Card>
              <Card className="stat-card">
                <Statistic
                  title={operationMode === "INBOUND" ? "待入库" : "当前在库"}
                  value={
                    operationMode === "INBOUND"
                      ? operationContext?.quantities.pendingInbound ?? 0
                      : operationContext?.quantities.inStock ?? 0
                  }
                  suffix="个码"
                />
              </Card>
            </div>

            <Card
              className="placeholder-card"
              title="当前任务上下文"
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  loading={isContextLoading}
                  onClick={() => void loadContext(operationMode, operationContext?.batch.id)}
                >
                  刷新
                </Button>
              }
            >
              {operationContext ? (
                <Descriptions column={1} size="small" labelStyle={{ width: 110 }}>
                  <Descriptions.Item label="当前操作">
                    {operationMode === "INBOUND" ? "扫码入库" : "扫码出库"}
                  </Descriptions.Item>
                  <Descriptions.Item label="任务编号">{operationContext.task.taskNo}</Descriptions.Item>
                  <Descriptions.Item label="业务单号">{operationContext.task.orderNo}</Descriptions.Item>
                  <Descriptions.Item label="批次号">{operationContext.batch.batchNo}</Descriptions.Item>
                  <Descriptions.Item label="合同号">{operationContext.contract.contractNo}</Descriptions.Item>
                  <Descriptions.Item label="仓库">{operationContext.warehouse.name}</Descriptions.Item>
                  <Descriptions.Item label="货物">{operationContext.batch.productName}</Descriptions.Item>
                  {operationMode === "INBOUND" ? (
                    <>
                      <Descriptions.Item label="预约号">{operationContext.task.appointmentNo ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="预约时间">
                        {formatDateTime(operationContext.task.appointmentTime)}
                      </Descriptions.Item>
                      <Descriptions.Item label="波次 / 月台">
                        {(operationContext.task.waveNo ?? "-") + " / " + (operationContext.task.dockNo ?? "-")}
                      </Descriptions.Item>
                      <Descriptions.Item label="到仓状态">
                        <Tag color={getStatusColor(operationContext.task.arrivalStatus)}>
                          {operationContext.task.arrivalStatus ?? "-"}
                        </Tag>
                      </Descriptions.Item>
                    </>
                  ) : (
                    <>
                      <Descriptions.Item label="波次号">{operationContext.task.waveNo ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="提货清单">{operationContext.task.pickupListNo ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="复核状态">
                        <Tag color={getStatusColor(operationContext.task.reviewStatus)}>
                          {operationContext.task.reviewStatus ?? "-"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="拣货状态">
                        <Tag color={getStatusColor(operationContext.task.pickingStatus)}>
                          {operationContext.task.pickingStatus ?? "-"}
                        </Tag>
                      </Descriptions.Item>
                    </>
                  )}
                  <Descriptions.Item label="状态">
                    <Tag color={getStatusColor(operationContext.task.status)}>{operationContext.task.status}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty description="仓储任务上下文加载中" />
              )}
            </Card>

            <Card className="placeholder-card" title={operationMeta.title}>
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Select
                  value={mode === operationMode ? selectedLocationId : undefined}
                  options={locationOptions}
                  placeholder="选择目标库位"
                  onFocus={() => setMode(operationMode)}
                  onChange={(value) => {
                    setMode(operationMode);
                    setSelectedLocationId(value);
                  }}
                />

                <Input.Search
                  value={mode === operationMode ? manualCode : ""}
                  allowClear
                  enterButton={operationMode === "INBOUND" ? "预检入库" : "预检出库"}
                  placeholder="支持扫描枪输入或手动粘贴二维码编号"
                  onFocus={() => setMode(operationMode)}
                  onChange={(event) => {
                    setMode(operationMode);
                    setManualCode(event.target.value);
                  }}
                  onSearch={(value) => void previewScan(value, operationMode)}
                  loading={isPreviewLoading && mode === operationMode}
                />

                <Space wrap>
                  <Button
                    type={cameraEnabled && mode === operationMode ? "default" : "primary"}
                    icon={<CameraOutlined />}
                    loading={cameraBusy && !cameraEnabled}
                    onClick={() => {
                      setMode(operationMode);
                      void startCameraScanner();
                    }}
                    disabled={cameraEnabled}
                  >
                    开启摄像头扫码
                  </Button>
                  <Button
                    icon={<StopOutlined />}
                    onClick={() => void stopCameraScanner()}
                    disabled={!cameraEnabled}
                    loading={cameraBusy && cameraEnabled}
                  >
                    关闭摄像头扫码
                  </Button>
                  <Button
                    icon={<ScanOutlined />}
                    onClick={() => void runBulkAction(5, operationMode)}
                    loading={isBulkRunning}
                  >
                    Demo 批量处理 5 个
                  </Button>
                </Space>

                <div id={scannerRegionId} className={`warehouse-camera-panel${cameraEnabled ? " is-active" : ""}`}>
                  {!cameraEnabled ? (
                    <div className="warehouse-camera-placeholder">
                      <CameraOutlined />
                      <span>开启后可直接用手机摄像头扫码</span>
                    </div>
                  ) : null}
                </div>

                <div className="documents-notes">
                  <div>当前操作类型：{operationMode === "INBOUND" ? "扫码入库" : "扫码出库"}</div>
                  <div>当前任务编号：{operationContext?.task.taskNo ?? "-"}</div>
                  <div>当前批次号：{operationContext?.batch.batchNo ?? "-"}</div>
                  <div>当前合同号：{operationContext?.contract.contractNo ?? "-"}</div>
                  <div>当前仓库：{operationContext?.warehouse.name ?? "-"}</div>
                </div>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={15}>
            <Card className="placeholder-card" title="库存与二维码状态总览">
              {operationContext ? (
                <Row gutter={[16, 16]}>
                  <Col xs={12} md={8}>
                    <Statistic title="总二维码" value={operationContext.qrSummary.total} suffix="个" />
                  </Col>
                  <Col xs={12} md={8}>
                    <Statistic title="待入库" value={operationContext.qrSummary.pendingInbound} suffix="个" />
                  </Col>
                  <Col xs={12} md={8}>
                    <Statistic title="在库" value={operationContext.qrSummary.inStock} suffix="个" />
                  </Col>
                  <Col xs={12} md={8}>
                    <Statistic title="已出库" value={operationContext.qrSummary.outbound} suffix="个" />
                  </Col>
                  <Col xs={12} md={8}>
                    <Statistic title="冻结" value={operationContext.qrSummary.frozen} suffix="个" />
                  </Col>
                  <Col xs={12} md={8}>
                    <Statistic
                      title="异常状态"
                      value={operationContext.qrSummary.damaged + operationContext.qrSummary.lost}
                      suffix="个"
                    />
                  </Col>
                </Row>
              ) : (
                <Empty description="暂无上下文数据" />
              )}
            </Card>

            <Card className="placeholder-card" title="最近扫码记录">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={recentColumns}
                dataSource={operationContext?.recentScanRecords ?? []}
                locale={{ emptyText: "当前模式还没有成功扫码记录" }}
                scroll={{ x: 860 }}
              />
            </Card>

            <Card
              className="placeholder-card"
              title={
                <Space>
                  <ExclamationCircleOutlined />
                  <span>异常扫码记录</span>
                </Space>
              }
            >
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={exceptionColumns}
                dataSource={operationExceptions}
                locale={{ emptyText: "当前还没有异常扫码" }}
                scroll={{ x: 860 }}
              />
            </Card>

            <Card className="placeholder-card" title="当前模式操作要求">
              <List
                dataSource={
                  operationMode === "INBOUND"
                    ? [
                        "二维码必须存在，并且属于当前合同、当前批次、当前预收货 / 入库任务。",
                        "只有状态为 PENDING_INBOUND 的二维码才允许进入确认入库。",
                        "如果已经入库、已经出库或扫到其他批次，系统会直接拒绝。"
                      ]
                    : [
                        "二维码必须存在，并且属于当前销售单 / 出库任务和当前批次。",
                        "只有状态为 IN_STOCK 的二维码才允许进入确认出库。",
                        "如果尚未入库、已出库、已冻结或状态异常，系统会直接拒绝。"
                      ]
                }
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  useEffect(() => {
    void refreshWarehouseWorkspace();
  }, []);

  useEffect(() => {
    if (currentContext) {
      setSelectedLocationId(currentContext.warehouse.locationId ?? currentContext.locations[0]?.id);
    }
  }, [currentContext?.warehouse.locationId, currentContext?.locations, mode]);

  useEffect(() => {
    if (workbench?.preReceiveOrders.length) {
      setSelectedPreReceiveId((previous) =>
        previous && workbench.preReceiveOrders.some((item) => item.id === previous)
          ? previous
          : workbench.preReceiveOrders[0].id
      );
    } else {
      setSelectedPreReceiveId(null);
    }

    if (workbench?.outboundOrders.length) {
      setSelectedOutboundId((previous) =>
        previous && workbench.outboundOrders.some((item) => item.id === previous)
          ? previous
          : workbench.outboundOrders[0].id
      );
    } else {
      setSelectedOutboundId(null);
    }
  }, [workbench]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          void scannerRef.current.stop();
        } catch {
          // ignore cleanup errors on unmount
        }

        try {
          scannerRef.current.clear();
        } catch {
          // ignore cleanup errors on unmount
        }
      }
    };
  }, []);

  return (
    <div className="document-workspace warehouse-workspace">
      <section className="page-hero">
        <Space wrap size={[12, 12]} align="center">
          <Tag color="geekblue" className="warehouse-mode-tag">
            仓储管理
          </Tag>
          <h2>仓储管理工作台</h2>
        </Space>
        <p>
          这一页现在按成熟 ERP 的仓储工作台方式重组为四个区域：预收货管理、扫码收货验收、库存管理、销售出库管理。
          其中库存变化仍然只由真实二维码状态和库存流水计算，不会因为列表页展示或任务推进按钮被直接写死。
        </p>
        <Alert
          type="info"
          showIcon
          message="阶段 14 继续复用真实扫码闭环"
          description="预收货和销售出库用工作台视角做增强展示；真正的入库、出库、库存变化依然通过现有扫码预检、人工确认和 StockMovement 写入完成。"
        />
      </section>

      {lastSuccessMessage ? (
        <Alert
          type="success"
          showIcon
          closable
          icon={<CheckCircleOutlined />}
          message={lastSuccessMessage}
          onClose={() => setLastSuccessMessage(null)}
        />
      ) : null}

      <div className="document-summary-grid warehouse-workbench-grid">
        <Card className="stat-card">
          <Statistic title="预收货任务" value={workbench?.summary.preReceiveTotal ?? 0} suffix="单" />
        </Card>
        <Card className="stat-card">
          <Statistic title="待扫码入库" value={workbench?.summary.pendingInboundQrCount ?? 0} suffix="个码" />
        </Card>
        <Card className="stat-card">
          <Statistic title="在库二维码" value={workbench?.summary.inStockQrCount ?? 0} suffix="个码" />
        </Card>
        <Card className="stat-card">
          <Statistic title="销售出库任务" value={workbench?.summary.outboundTotal ?? 0} suffix="单" />
        </Card>
        <Card className="stat-card">
          <Statistic title="已出库二维码" value={workbench?.summary.outboundQrCount ?? 0} suffix="个码" />
        </Card>
        <Card className="stat-card">
          <Statistic title="未处理异常" value={workbench?.summary.openAnomalyCount ?? 0} suffix="条" />
        </Card>
        <Card className="stat-card">
          <Statistic title="未完成盘点" value={workbench?.summary.stocktakePendingCount ?? 0} suffix="单" />
        </Card>
        <Card className="stat-card">
          <Statistic title="仓库数" value={workbench?.summary.warehouseCount ?? 0} suffix="个" />
        </Card>
      </div>

      <Card
        className="placeholder-card warehouse-workbench-card"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void refreshWarehouseWorkspace()} loading={isWorkbenchLoading}>
            刷新仓储工作台
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          destroyInactiveTabPane
          onChange={handleTabChange}
          items={[
            {
              key: "preReceive",
              label: `预收货管理 (${workbench?.preReceiveOrders.length ?? 0})`,
              children: (
                <Row gutter={[20, 20]}>
                  <Col xs={24} xl={14}>
                    <Card className="placeholder-card warehouse-section-card" title="预收货任务列表" loading={isWorkbenchLoading}>
                      <Table
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 6, hideOnSinglePage: true }}
                        columns={preReceiveColumns}
                        dataSource={workbench?.preReceiveOrders ?? []}
                        locale={{ emptyText: "当前还没有预收货任务" }}
                        scroll={{ x: 1120 }}
                        rowClassName={(record) =>
                          record.id === selectedPreReceive?.id ? "inventory-table-row-active" : ""
                        }
                        onRow={(record) => ({
                          onClick: () => setSelectedPreReceiveId(record.id)
                        })}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} xl={10}>
                    <Card
                      className="placeholder-card warehouse-section-card"
                      title="预收货详情"
                      extra={
                        <Button
                          type="primary"
                          onClick={() => openInboundConsole(selectedPreReceive)}
                          disabled={!selectedPreReceive?.batchId}
                        >
                          进入扫码收货验收
                        </Button>
                      }
                    >
                      {selectedPreReceive ? (
                        <Space direction="vertical" style={{ width: "100%" }} size="middle">
                          <Descriptions column={1} size="small" labelStyle={{ width: 118 }}>
                            <Descriptions.Item label="预收货单号">{selectedPreReceive.preReceiveNo}</Descriptions.Item>
                            <Descriptions.Item label="关联合同">{selectedPreReceive.contractNo}</Descriptions.Item>
                            <Descriptions.Item label="关联批次">{selectedPreReceive.batchNo}</Descriptions.Item>
                            <Descriptions.Item label="预约号">{selectedPreReceive.appointmentNo ?? "-"}</Descriptions.Item>
                            <Descriptions.Item label="预约时间">
                              {formatDateTime(selectedPreReceive.appointmentTime)}
                            </Descriptions.Item>
                            <Descriptions.Item label="波次 / 月台">
                              {(selectedPreReceive.waveNo ?? "-") + " / " + (selectedPreReceive.dockNo ?? "-")}
                            </Descriptions.Item>
                            <Descriptions.Item label="到仓状态">
                              <Tag color={getStatusColor(selectedPreReceive.arrivalStatus)}>
                                {selectedPreReceive.arrivalStatus ?? "-"}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="预收货状态">
                              <Tag color={getStatusColor(selectedPreReceive.status)}>{selectedPreReceive.status}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="业务单号">{selectedPreReceive.inboundNo}</Descriptions.Item>
                            <Descriptions.Item label="目的仓库">{selectedPreReceive.warehouseName}</Descriptions.Item>
                            <Descriptions.Item label="建议库位">
                              {selectedPreReceive.suggestedLocation ?? "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="SKU">{selectedPreReceive.skuName}</Descriptions.Item>
                            <Descriptions.Item label="数量">
                              {selectedPreReceive.quantity}
                              {selectedPreReceive.unit}
                            </Descriptions.Item>
                            <Descriptions.Item label="已扫 / 剩余">
                              {selectedPreReceive.scannedQuantity} / {selectedPreReceive.remainingQuantity}
                            </Descriptions.Item>
                            <Descriptions.Item label="预计到仓">
                              {formatDateTime(selectedPreReceive.expectedArrivalTime)}
                            </Descriptions.Item>
                          </Descriptions>

                          <div className="document-summary-grid warehouse-mini-grid">
                            <Card className="stat-card">
                              <Statistic title="待入库码" value={selectedPreReceive.qrSummary.pendingInbound} suffix="个" />
                            </Card>
                            <Card className="stat-card">
                              <Statistic title="已在库码" value={selectedPreReceive.qrSummary.inStock} suffix="个" />
                            </Card>
                            <Card className="stat-card">
                              <Statistic title="已出库码" value={selectedPreReceive.qrSummary.outbound} suffix="个" />
                            </Card>
                            <Card className="stat-card">
                              <Statistic title="冻结码" value={selectedPreReceive.qrSummary.frozen} suffix="个" />
                            </Card>
                          </div>

                          <Card size="small" className="placeholder-card" title="该仓库可用库位">
                            <List
                              size="small"
                              dataSource={focusLocations}
                              locale={{ emptyText: "当前仓库还没有可展示的库位" }}
                              renderItem={(item) => (
                                <List.Item>
                                  <Space wrap>
                                    <strong>{item.locationCode}</strong>
                                    {item.zone ? <span>{item.zone}</span> : null}
                                    <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
                                    {item.isSuggestedForInbound ? <Tag color="processing">建议入库位</Tag> : null}
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Card>
                        </Space>
                      ) : (
                        <Empty description="请选择一条预收货任务" />
                      )}
                    </Card>
                  </Col>
                </Row>
              )
            },
            {
              key: "scanInbound",
              label: `扫码收货验收 (${contextByMode.INBOUND?.quantities.remaining ?? 0} 待扫)`,
              children: renderScanSection("INBOUND")
            },
            {
              key: "inventory",
              label: "库存管理",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <Card className="placeholder-card warehouse-section-card" loading={isWorkbenchLoading}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={8}>
                        <Statistic title="当前聚焦合同" value={workbench?.focus.contractNo ?? "-"} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Statistic title="当前聚焦批次" value={workbench?.focus.batchNo ?? "-"} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Statistic title="当前聚焦仓库" value={workbench?.focus.warehouseName ?? "-"} />
                      </Col>
                    </Row>
                  </Card>

                  <Row gutter={[20, 20]}>
                    <Col xs={24} xl={10}>
                      <Card
                        className="placeholder-card warehouse-section-card"
                        title="多级二维码与冻结控制"
                        extra={
                          <Button
                            icon={<ReloadOutlined />}
                            onClick={() => void loadFocusQrItems(currentContext?.batch.id ?? workbench?.focus.batchId)}
                            loading={isFocusQrItemsLoading}
                          >
                            刷新二维码
                          </Button>
                        }
                      >
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                          <Alert
                            type="info"
                            showIcon
                            message="阶段 23：最小包装码 / 箱码 / 托盘码"
                            description={`当前聚焦批次已形成 ${currentContext?.hierarchySummary.unitCount ?? 0} 个最小包装码、${currentContext?.hierarchySummary.boxCount ?? 0} 个箱码、${currentContext?.hierarchySummary.palletCount ?? 0} 个托盘码。`}
                          />
                          <Table
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5, hideOnSinglePage: true }}
                            columns={focusQrColumns}
                            dataSource={focusQrItems}
                            loading={isFocusQrItemsLoading}
                            rowClassName={(record) =>
                              record.id === selectedFocusQrItem?.id ? "inventory-table-row-active" : ""
                            }
                            onRow={(record) => ({
                              onClick: () => setSelectedQrItemId(record.id)
                            })}
                            locale={{ emptyText: "当前批次还没有可展示的二维码。" }}
                            scroll={{ x: 860 }}
                          />
                          {selectedFocusQrItem ? (
                            <Card size="small" className="placeholder-card" title="当前选中二维码">
                              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                                <Typography.Text strong>{selectedFocusQrItem.qrCode}</Typography.Text>
                                <Typography.Text type="secondary">
                                  {selectedFocusQrItem.unitTraceCode ?? "-"}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {selectedFocusQrItem.boxTraceCode ?? "-"} / {selectedFocusQrItem.palletTraceCode ?? "-"}
                                </Typography.Text>
                                <Space wrap>
                                  <Tag color={qrStatusColorMap[selectedFocusQrItem.status] ?? "default"}>
                                    {selectedFocusQrItem.status}
                                  </Tag>
                                  {selectedFocusQrItem.freezeReason ? (
                                    <Tag color="warning">{selectedFocusQrItem.freezeReason}</Tag>
                                  ) : null}
                                </Space>
                                <Space wrap>
                                  {selectedFocusQrItem.status === "IN_STOCK" ? (
                                    <Button onClick={() => void toggleFreezeQrItem(selectedFocusQrItem.id, "freeze")}>
                                      冻结库存
                                    </Button>
                                  ) : null}
                                  {selectedFocusQrItem.status === "FROZEN" ? (
                                    <Button onClick={() => void toggleFreezeQrItem(selectedFocusQrItem.id, "unfreeze")}>
                                      解冻库存
                                    </Button>
                                  ) : null}
                                </Space>
                              </Space>
                            </Card>
                          ) : null}
                        </Space>
                      </Card>
                    </Col>

                    <Col xs={24} xl={14}>
                      <Card
                        className="placeholder-card warehouse-section-card"
                        title="异常与盘点执行"
                        extra={
                          <Space wrap>
                            <Button onClick={() => setIsAnomalyModalOpen(true)}>上报异常</Button>
                            <Button type="primary" loading={isStocktakeSubmitting} onClick={() => void createStocktake()}>
                              创建盘点
                            </Button>
                          </Space>
                        }
                      >
                        <Space direction="vertical" size="large" style={{ width: "100%" }}>
                          <Card size="small" className="placeholder-card" title="仓储异常记录">
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={{ pageSize: 4, hideOnSinglePage: true }}
                              columns={anomalyColumns}
                              dataSource={workbench?.anomalies ?? []}
                              locale={{ emptyText: "当前还没有仓储异常。" }}
                              scroll={{ x: 980 }}
                            />
                            {(workbench?.anomalies ?? []).length > 0 ? (
                              <Space wrap style={{ marginTop: 12 }}>
                                {(workbench?.anomalies ?? [])
                                  .filter((item) => item.status === "OPEN")
                                  .slice(0, 3)
                                  .map((item) => (
                                    <Button key={item.id} onClick={() => void handleAnomaly(item.id)}>
                                      处理 {item.anomalyNo}
                                    </Button>
                                  ))}
                              </Space>
                            ) : null}
                          </Card>

                          <Card size="small" className="placeholder-card" title="盘点任务">
                            <Table
                              rowKey="id"
                              size="small"
                              pagination={{ pageSize: 4, hideOnSinglePage: true }}
                              columns={workbenchStocktakeColumns}
                              dataSource={workbench?.stocktakes ?? []}
                              locale={{ emptyText: "当前还没有盘点任务。" }}
                              rowClassName={(record) =>
                                record.id === selectedWorkbenchStocktake?.id ? "inventory-table-row-active" : ""
                              }
                              onRow={(record) => ({
                                onClick: () => setSelectedStocktakeId(record.id)
                              })}
                              scroll={{ x: 940 }}
                            />
                            <Space wrap style={{ marginTop: 12 }}>
                              <InputNumber
                                min={0}
                                placeholder="实际盘点数量"
                                value={stocktakeActualQuantity ?? undefined}
                                onChange={(value) => setStocktakeActualQuantity(typeof value === "number" ? value : null)}
                              />
                              <Input
                                style={{ width: 260 }}
                                placeholder="盘点备注"
                                value={stocktakeNote}
                                onChange={(event) => setStocktakeNote(event.target.value)}
                              />
                              <Button
                                type="primary"
                                disabled={!selectedWorkbenchStocktake || selectedWorkbenchStocktake.status === "COMPLETED"}
                                loading={isStocktakeSubmitting}
                                onClick={() =>
                                  selectedWorkbenchStocktake
                                    ? void completeStocktake(selectedWorkbenchStocktake.id)
                                    : undefined
                                }
                              >
                                完成所选盘点
                              </Button>
                            </Space>
                          </Card>
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  <WarehouseInventorySection
                    data={inventorySummary}
                    loading={isInventoryLoading}
                    onRefresh={() => void loadInventorySummary()}
                    currentBatchId={currentContext?.batch.id}
                    currentContractId={currentContext?.contract.id}
                    currentWarehouseId={currentContext?.warehouse.id}
                  />
                </Space>
              )
            },
            {
              key: "outbound",
              label: `销售出库管理 (${workbench?.outboundOrders.length ?? 0})`,
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <Row gutter={[20, 20]}>
                    <Col xs={24} xl={14}>
                      <Card className="placeholder-card warehouse-section-card" title="销售出库任务列表" loading={isWorkbenchLoading}>
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 6, hideOnSinglePage: true }}
                          columns={outboundColumns}
                          dataSource={workbench?.outboundOrders ?? []}
                          locale={{ emptyText: "当前还没有销售出库任务" }}
                          scroll={{ x: 1120 }}
                          rowClassName={(record) =>
                            record.id === selectedOutbound?.id ? "inventory-table-row-active" : ""
                          }
                          onRow={(record) => ({
                            onClick: () => setSelectedOutboundId(record.id)
                          })}
                        />
                      </Card>
                    </Col>

                    <Col xs={24} xl={10}>
                      <Card
                        className="placeholder-card warehouse-section-card"
                        title="销售出库详情"
                        extra={
                          <Button
                            type="primary"
                            onClick={() => openOutboundConsole(selectedOutbound)}
                            disabled={!selectedOutbound?.batchId}
                          >
                            进入出库扫码
                          </Button>
                        }
                      >
                        {selectedOutbound ? (
                          <Space direction="vertical" style={{ width: "100%" }} size="middle">
                            <Descriptions column={1} size="small" labelStyle={{ width: 118 }}>
                              <Descriptions.Item label="出库单号">{selectedOutbound.outboundNo}</Descriptions.Item>
                              <Descriptions.Item label="销售单号">{selectedOutbound.salesNo}</Descriptions.Item>
                              <Descriptions.Item label="关联合同">{selectedOutbound.contractNo}</Descriptions.Item>
                              <Descriptions.Item label="关联批次">{selectedOutbound.batchNo}</Descriptions.Item>
                              <Descriptions.Item label="出库波次">{selectedOutbound.waveNo ?? "-"}</Descriptions.Item>
                              <Descriptions.Item label="提货清单">{selectedOutbound.pickupListNo ?? "-"}</Descriptions.Item>
                              <Descriptions.Item label="复核状态">
                                <Tag color={getStatusColor(selectedOutbound.reviewStatus)}>
                                  {selectedOutbound.reviewStatus ?? "-"}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="拣货状态">
                                <Tag color={getStatusColor(selectedOutbound.pickingStatus)}>
                                  {selectedOutbound.pickingStatus ?? "-"}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="客户">{selectedOutbound.customerName}</Descriptions.Item>
                              <Descriptions.Item label="商品">{selectedOutbound.skuName}</Descriptions.Item>
                              <Descriptions.Item label="数量">
                                {selectedOutbound.quantity}
                                {selectedOutbound.unit}
                              </Descriptions.Item>
                              <Descriptions.Item label="已扫 / 剩余">
                                {selectedOutbound.scannedQuantity} / {selectedOutbound.remainingQuantity}
                              </Descriptions.Item>
                              <Descriptions.Item label="出库状态">
                                <Tag color={getStatusColor(selectedOutbound.status)}>{selectedOutbound.status}</Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="配送方式">
                                {selectedOutbound.deliveryMethod ?? "-"}
                              </Descriptions.Item>
                              <Descriptions.Item label="配送状态">
                                {selectedOutbound.deliveryStatus ?? "-"}
                              </Descriptions.Item>
                              <Descriptions.Item label="签收状态">{selectedOutbound.signStatus ?? "-"}</Descriptions.Item>
                            </Descriptions>

                            <div className="document-summary-grid warehouse-mini-grid">
                              <Card className="stat-card">
                                <Statistic title="在库可扫" value={selectedOutbound.inStockAvailable} suffix="个" />
                              </Card>
                              <Card className="stat-card">
                                <Statistic title="已出库码" value={selectedOutbound.qrSummary.outbound} suffix="个" />
                              </Card>
                              <Card className="stat-card">
                                <Statistic title="待入库码" value={selectedOutbound.qrSummary.pendingInbound} suffix="个" />
                              </Card>
                              <Card className="stat-card">
                                <Statistic title="冻结码" value={selectedOutbound.qrSummary.frozen} suffix="个" />
                              </Card>
                            </div>

                            <Card size="small" className="placeholder-card" title="双人复核推进">
                              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                                <Typography.Text type="secondary">
                                  一审完成后进入拣货中，二审完成后进入可扫码出库状态。
                                </Typography.Text>
                                <Space wrap>
                                  <Button
                                    onClick={() => void advanceReview(selectedOutbound.id, "first")}
                                    disabled={selectedOutbound.reviewStatus === "FIRST_APPROVED" || selectedOutbound.reviewStatus === "APPROVED"}
                                  >
                                    一审通过
                                  </Button>
                                  <Button
                                    type="primary"
                                    onClick={() => void advanceReview(selectedOutbound.id, "second")}
                                    disabled={selectedOutbound.reviewStatus !== "FIRST_APPROVED"}
                                  >
                                    二审通过
                                  </Button>
                                </Space>
                                <Typography.Text type="secondary">
                                  一审：{selectedOutbound.firstReviewerName ?? "-"} / {formatDateTime(selectedOutbound.firstReviewedAt)}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  二审：{selectedOutbound.secondReviewerName ?? "-"} / {formatDateTime(selectedOutbound.secondReviewedAt)}
                                </Typography.Text>
                              </Space>
                            </Card>
                          </Space>
                        ) : (
                          <Empty description="请选择一条销售出库任务" />
                        )}
                      </Card>
                    </Col>
                  </Row>

                  {renderScanSection("OUTBOUND")}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        open={isAnomalyModalOpen}
        title="上报仓储异常"
        okText="提交异常"
        cancelText="取消"
        onCancel={() => setIsAnomalyModalOpen(false)}
        onOk={() => void reportAnomaly()}
        confirmLoading={isSubmittingAnomaly}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Select
            value={anomalyDraft.mode}
            options={anomalyModeOptions.map((item) => ({ label: item.label, value: item.value }))}
            onChange={(value) => setAnomalyDraft((previous) => ({ ...previous, mode: value }))}
          />
          <Select
            value={anomalyDraft.anomalyType}
            options={anomalyTypeOptions.map((item) => ({ label: item.label, value: item.value }))}
            onChange={(value) => setAnomalyDraft((previous) => ({ ...previous, anomalyType: value }))}
          />
          <InputNumber
            min={1}
            style={{ width: "100%" }}
            value={anomalyDraft.quantity}
            onChange={(value) =>
              setAnomalyDraft((previous) => ({ ...previous, quantity: typeof value === "number" ? value : 1 }))
            }
            placeholder="异常数量"
          />
          <Input
            value={anomalyDraft.qrCode}
            onChange={(event) => setAnomalyDraft((previous) => ({ ...previous, qrCode: event.target.value }))}
            placeholder="相关二维码，可选"
          />
          <Input.TextArea
            rows={4}
            value={anomalyDraft.description}
            onChange={(event) => setAnomalyDraft((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="请填写异常说明，例如错货、破损、漏扫、错批次等"
          />
        </Space>
      </Modal>

      <Modal
        open={isPreviewVisible}
        title={preview?.operationType === "OUTBOUND" ? "确认扫码出库" : "确认扫码入库"}
        okText={preview?.operationType === "OUTBOUND" ? "确认出库" : "确认入库"}
        cancelText="取消"
        onCancel={() => {
          setIsPreviewVisible(false);
          setPreview(null);
        }}
        onOk={() => void confirmScan()}
        confirmLoading={isConfirming}
      >
        {preview ? (
          <Descriptions column={1} bordered size="small" className="warehouse-confirm-panel">
            <Descriptions.Item label="当前操作">
              {preview.operationType === "OUTBOUND" ? "扫码出库" : "扫码入库"}
            </Descriptions.Item>
            <Descriptions.Item label="二维码编号">{preview.qrCode}</Descriptions.Item>
            <Descriptions.Item label="商品名称">{preview.productName ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="合同号">{preview.contractNo}</Descriptions.Item>
            <Descriptions.Item label="批次号">{preview.batchNo}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={qrStatusColorMap[preview.currentStatus] ?? "default"}>{preview.currentStatus}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="目标仓库">{preview.warehouseName}</Descriptions.Item>
            <Descriptions.Item label="目标库位">{preview.locationCode ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="当前任务">{preview.taskNo}</Descriptions.Item>
            <Descriptions.Item label="校验结果">
              <Alert type="success" showIcon message={preview.summary.operatorStep} description={preview.summary.message} />
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
