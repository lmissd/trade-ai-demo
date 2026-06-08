import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CameraOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  ScanOutlined,
  StopOutlined
} from "@ant-design/icons";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { requestJson } from "../lib/api";

type ScanMode = "INBOUND" | "OUTBOUND";

type WarehouseContext = {
  mode: ScanMode;
  task: {
    id: string;
    taskNo: string;
    orderNo: string;
    type: string;
    status: string;
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

const modeOptionList = [
  { label: "扫码入库", value: "INBOUND" },
  { label: "扫码出库", value: "OUTBOUND" }
] satisfies Array<{ label: string; value: ScanMode }>;

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
        title: "扫码入库控制台",
        titleTag: "入库模式",
        note: "当前页面只允许处理待入库二维码，扫到其他状态、其他批次或其他任务的货物都会被拦截。",
        buttonText: "确认入库",
        successText: "入库已确认",
        color: "processing" as const
      }
    : {
        title: "扫码出库控制台",
        titleTag: "出库模式",
        note: "当前页面只允许处理已在库二维码，未入库、已出库、冻结或异常状态都会被拒绝。",
        buttonText: "确认出库",
        successText: "出库已确认",
        color: "volcano" as const
      };
}

export function WarehousePage() {
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

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = "warehouse-camera-scanner";

  const context = contextByMode[mode] ?? null;
  const meta = getOperationMeta(mode);

  const locationOptions = useMemo(
    () =>
      (context?.locations ?? []).map((location) => ({
        label: `${location.locationCode}${location.zone ? ` · ${location.zone}` : ""}`,
        value: location.id
      })),
    [context]
  );

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

  function pushExceptionRecord(qrCode: string, errorMessage: string) {
    setExceptionRecords((previous) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        qrCode,
        message: errorMessage,
        mode,
        createdAt: new Date().toISOString()
      },
      ...previous
    ]);
  }

  async function previewScan(qrCodeInput: string) {
    const qrCode = qrCodeInput.trim();

    if (!context) {
      message.warning("当前仓储任务还未加载完成。");
      return;
    }

    if (!qrCode) {
      message.warning("请先输入或扫描二维码。");
      return;
    }

    setIsPreviewLoading(true);

    try {
      const nextPreview = await requestJson<ScanPreview>("/api/warehouse/scan/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          qrCode,
          batchId: context.batch.id,
          taskId: context.task.id,
          contractId: context.contract.id,
          warehouseId: context.warehouse.id,
          locationId: selectedLocationId ?? context.warehouse.locationId
        })
      });

      setPreview(nextPreview);
      setIsPreviewVisible(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "扫码预检失败。";
      pushExceptionRecord(qrCode, errorMessage);
      message.error(errorMessage);
    } finally {
      setIsPreviewLoading(false);
      setManualCode("");
    }
  }

  async function confirmScan() {
    if (!preview || !context) {
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
          mode,
          qrItemId: preview.qrItemId,
          batchId: context.batch.id,
          taskId: context.task.id,
          contractId: context.contract.id,
          warehouseId: context.warehouse.id,
          locationId: preview.locationId ?? selectedLocationId ?? context.warehouse.locationId
        })
      });

      setContextByMode((previous) => ({
        ...previous,
        [mode]: result.context
      }));
      await loadContext(mode === "INBOUND" ? "OUTBOUND" : "INBOUND", context.batch.id);
      setLastSuccessMessage(`${meta.successText}：${result.qrItem.qrCode}`);
      setIsPreviewVisible(false);
      setPreview(null);
      message.success(result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "确认扫码失败。";
      if (preview) {
        pushExceptionRecord(preview.qrCode, errorMessage);
      }
      message.error(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  }

  async function runBulkAction(quantity: number) {
    if (!context) {
      message.warning("当前仓储任务还未加载完成。");
      return;
    }

    setIsBulkRunning(true);

    try {
      const result = await requestJson<BulkScanResponse>("/api/warehouse/scan/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          batchId: context.batch.id,
          taskId: context.task.id,
          contractId: context.contract.id,
          warehouseId: context.warehouse.id,
          locationId: selectedLocationId ?? context.warehouse.locationId,
          quantity
        })
      });

      setContextByMode((previous) => ({
        ...previous,
        [mode]: result.context
      }));
      await loadContext(mode === "INBOUND" ? "OUTBOUND" : "INBOUND", context.batch.id);

      if (result.failures.length > 0) {
        setExceptionRecords((previous) => [
          ...result.failures.map((failure, index) => ({
            id: `${Date.now()}-${index}-${failure.qrCode}`,
            qrCode: failure.qrCode,
            message: failure.message,
            mode,
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
          void previewScan(decodedText);
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

  useEffect(() => {
    void Promise.all([loadContext("INBOUND"), loadContext("OUTBOUND")]);
  }, []);

  useEffect(() => {
    if (context) {
      setSelectedLocationId(context.warehouse.locationId ?? context.locations[0]?.id);
    }
  }, [context?.warehouse.locationId, context?.locations]);

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
          <Tag color={meta.color} className="warehouse-mode-tag">
            {meta.titleTag}
          </Tag>
          <h2>{meta.title}</h2>
        </Space>
        <p>
          仓储扫码环节现在已经切到真实业务模式：货物二维码只代表货物身份，入库或出库由当前任务上下文决定。扫错码、
          进错页面、扫到其他批次、重复扫码，系统都会先拦截，再决定是否允许人工确认。
        </p>
        <Alert
          type={mode === "INBOUND" ? "info" : "warning"}
          showIcon
          message={meta.note}
          description="扫码成功不等于业务成功，只有‘扫码命中 + 校验通过 + 人工确认’后，系统才会真正更新 QrItem 和库存流水。"
        />
      </section>

      <Segmented<ScanMode>
        size="large"
        block
        options={modeOptionList}
        value={mode}
        onChange={(value) => setMode(value)}
      />

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

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <div className="document-summary-grid warehouse-summary-grid">
            <Card className="stat-card">
              <Statistic title="应扫数量" value={context?.quantities.target ?? 0} suffix={context?.batch.unit ?? "箱"} />
            </Card>
            <Card className="stat-card">
              <Statistic title="已扫数量" value={context?.quantities.scanned ?? 0} suffix={context?.batch.unit ?? "箱"} />
            </Card>
            <Card className="stat-card">
              <Statistic title="剩余数量" value={context?.quantities.remaining ?? 0} suffix={context?.batch.unit ?? "箱"} />
            </Card>
            <Card className="stat-card">
              <Statistic title={mode === "INBOUND" ? "待入库" : "当前在库"} value={mode === "INBOUND" ? context?.quantities.pendingInbound ?? 0 : context?.quantities.inStock ?? 0} suffix="个码" />
            </Card>
          </div>

          <Card
            className="placeholder-card"
            title="当前任务上下文"
            extra={
              <Button icon={<ReloadOutlined />} loading={isContextLoading} onClick={() => void loadContext(mode, context?.batch.id)}>
                刷新
              </Button>
            }
          >
            {context ? (
              <Descriptions column={1} size="small" labelStyle={{ width: 110 }}>
                <Descriptions.Item label="当前操作">{mode === "INBOUND" ? "扫码入库" : "扫码出库"}</Descriptions.Item>
                <Descriptions.Item label="任务编号">{context.task.taskNo}</Descriptions.Item>
                <Descriptions.Item label="业务单号">{context.task.orderNo}</Descriptions.Item>
                <Descriptions.Item label="批次号">{context.batch.batchNo}</Descriptions.Item>
                <Descriptions.Item label="合同号">{context.contract.contractNo}</Descriptions.Item>
                <Descriptions.Item label="仓库">{context.warehouse.name}</Descriptions.Item>
                <Descriptions.Item label="货物">{context.batch.productName}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color="processing">{context.task.status}</Tag>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="仓储任务上下文加载中" />
            )}
          </Card>

          <Card className="placeholder-card" title="扫码控制">
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Select
                value={selectedLocationId}
                options={locationOptions}
                placeholder="选择目标库位"
                onChange={(value) => setSelectedLocationId(value)}
              />

              <Input.Search
                value={manualCode}
                allowClear
                enterButton={mode === "INBOUND" ? "预检入库" : "预检出库"}
                placeholder="支持扫描枪输入或手动粘贴二维码编号"
                onChange={(event) => setManualCode(event.target.value)}
                onSearch={(value) => void previewScan(value)}
                loading={isPreviewLoading}
              />

              <Space wrap>
                <Button
                  type={cameraEnabled ? "default" : "primary"}
                  icon={<CameraOutlined />}
                  loading={cameraBusy && !cameraEnabled}
                  onClick={() => void startCameraScanner()}
                  disabled={cameraEnabled}
                >
                  开启摄像头扫码
                </Button>
                <Button icon={<StopOutlined />} onClick={() => void stopCameraScanner()} disabled={!cameraEnabled} loading={cameraBusy && cameraEnabled}>
                  关闭摄像头扫码
                </Button>
                <Button icon={<ScanOutlined />} onClick={() => void runBulkAction(5)} loading={isBulkRunning}>
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
                <div>当前操作类型：{mode === "INBOUND" ? "扫码入库" : "扫码出库"}</div>
                <div>当前任务编号：{context?.task.taskNo ?? "-"}</div>
                <div>当前批次号：{context?.batch.batchNo ?? "-"}</div>
                <div>当前合同号：{context?.contract.contractNo ?? "-"}</div>
                <div>当前仓库：{context?.warehouse.name ?? "-"}</div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card className="placeholder-card" title="库存与二维码状态总览">
            {context ? (
              <Row gutter={[16, 16]}>
                <Col xs={12} md={8}>
                  <Statistic title="总二维码" value={context.qrSummary.total} suffix="个" />
                </Col>
                <Col xs={12} md={8}>
                  <Statistic title="待入库" value={context.qrSummary.pendingInbound} suffix="个" />
                </Col>
                <Col xs={12} md={8}>
                  <Statistic title="在库" value={context.qrSummary.inStock} suffix="个" />
                </Col>
                <Col xs={12} md={8}>
                  <Statistic title="已出库" value={context.qrSummary.outbound} suffix="个" />
                </Col>
                <Col xs={12} md={8}>
                  <Statistic title="冻结" value={context.qrSummary.frozen} suffix="个" />
                </Col>
                <Col xs={12} md={8}>
                  <Statistic title="异常状态" value={context.qrSummary.damaged + context.qrSummary.lost} suffix="个" />
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
              dataSource={context?.recentScanRecords ?? []}
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
              dataSource={exceptionRecords}
              locale={{ emptyText: "当前还没有异常扫码" }}
              scroll={{ x: 860 }}
            />
          </Card>

          <Card className="placeholder-card" title="当前模式操作要求">
            <List
              dataSource={
                mode === "INBOUND"
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

      <Modal
        open={isPreviewVisible}
        title={mode === "INBOUND" ? "确认扫码入库" : "确认扫码出库"}
        okText={meta.buttonText}
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
            <Descriptions.Item label="当前操作">{mode === "INBOUND" ? "扫码入库" : "扫码出库"}</Descriptions.Item>
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
