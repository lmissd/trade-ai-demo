import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { requestJson, resolveApiUrl } from "../lib/api";

type BatchOption = {
  id: string;
  batchNo: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
};

type QrItemListRecord = {
  id: string;
  qrCode: string;
  serialNo: number;
  status: string;
  productName: string | null;
  currentWarehouse: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  batch: {
    id: string;
    batchNo: string;
    status: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
  } | null;
};

type QrItemDetail = {
  id: string;
  qrCode: string;
  serialNo: number;
  status: string;
  productName: string | null;
  currentWarehouse: string | null;
  warehouseId: string | null;
  locationId: string | null;
  inboundAt: string | null;
  outboundAt: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  imageFilePath: string;
  batch: {
    id: string;
    batchNo: string;
    status: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    amount: number;
    currency: string;
  } | null;
  stockMovements: Array<{
    id: string;
    movementType: string;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    occurredAt: string;
    note: string | null;
    remark: string | null;
  }>;
};

const qrStatusOptions = [
  { label: "全部状态", value: "ALL" },
  { label: "待入库", value: "PENDING_INBOUND" },
  { label: "在库", value: "IN_STOCK" },
  { label: "已出库", value: "OUTBOUND" },
  { label: "损坏", value: "DAMAGED" },
  { label: "丢失", value: "LOST" },
  { label: "冻结", value: "FROZEN" }
];

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

export function QrItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBatchId = searchParams.get("batchId") ?? undefined;
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [qrItems, setQrItems] = useState<QrItemListRecord[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(initialBatchId);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [keyword, setKeyword] = useState("");
  const [selectedQrItemId, setSelectedQrItemId] = useState<string | null>(null);
  const [selectedQrItemDetail, setSelectedQrItemDetail] = useState<QrItemDetail | null>(null);
  const [isBatchesLoading, setIsBatchesLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [generatingBatchId, setGeneratingBatchId] = useState<string | null>(null);
  const qrItemsRequestIdRef = useRef(0);
  const qrItemDetailRequestIdRef = useRef(0);

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const totalQrCount = qrItems.length;
  const inStockCount = qrItems.filter((item) => item.status === "IN_STOCK").length;
  const pendingInboundCount = qrItems.filter((item) => item.status === "PENDING_INBOUND").length;
  const outboundCount = qrItems.filter((item) => item.status === "OUTBOUND").length;

  async function loadBatches() {
    setIsBatchesLoading(true);

    try {
      const batchList = await requestJson<BatchOption[]>("/api/batches");
      setBatches(batchList);

      if (!selectedBatchId && batchList.length > 0) {
        setSelectedBatchId(batchList[0].id);
      }

      if (selectedBatchId && !batchList.some((item) => item.id === selectedBatchId)) {
        setSelectedBatchId(batchList[0]?.id);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载批次列表失败。");
    } finally {
      setIsBatchesLoading(false);
    }
  }

  async function loadQrItems() {
    const requestId = qrItemsRequestIdRef.current + 1;
    qrItemsRequestIdRef.current = requestId;
    setIsItemsLoading(true);

    try {
      if (!selectedBatchId) {
        setQrItems([]);
        setSelectedQrItemId(null);
        setSelectedQrItemDetail(null);
        return;
      }

      const searchParams = new URLSearchParams();
      searchParams.set("batchId", selectedBatchId);

      if (selectedStatus !== "ALL") {
        searchParams.set("status", selectedStatus);
      }

      if (keyword.trim()) {
        searchParams.set("keyword", keyword.trim());
      }

      const path = `/api/qr-items${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const items = await requestJson<QrItemListRecord[]>(path);

      if (requestId !== qrItemsRequestIdRef.current) {
        return;
      }

      setQrItems(items);

      if (!selectedQrItemId && items.length > 0) {
        setSelectedQrItemId(items[0].id);
      }

      if (selectedQrItemId && !items.some((item) => item.id === selectedQrItemId)) {
        setSelectedQrItemId(items[0]?.id ?? null);
      }
    } catch (error) {
      if (requestId === qrItemsRequestIdRef.current) {
        message.error(error instanceof Error ? error.message : "加载二维码列表失败。");
      }
    } finally {
      if (requestId === qrItemsRequestIdRef.current) {
        setIsItemsLoading(false);
      }
    }
  }

  async function loadQrItemDetail(qrItemId: string) {
    const requestId = qrItemDetailRequestIdRef.current + 1;
    qrItemDetailRequestIdRef.current = requestId;
    setIsDetailLoading(true);

    try {
      const detail = await requestJson<QrItemDetail>(`/api/qr-items/${qrItemId}`);

      if (requestId !== qrItemDetailRequestIdRef.current) {
        return;
      }

      setSelectedQrItemDetail(detail);
    } catch (error) {
      if (requestId === qrItemDetailRequestIdRef.current) {
        message.error(error instanceof Error ? error.message : "加载二维码详情失败。");
      }
    } finally {
      if (requestId === qrItemDetailRequestIdRef.current) {
        setIsDetailLoading(false);
      }
    }
  }

  async function handleGenerateQrItems(batchId: string) {
    setGeneratingBatchId(batchId);

    try {
      const result = await requestJson<{ created: boolean; message: string }>("/api/qr-items/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ batchId })
      });

      message.success(result.created ? "二维码已生成。" : "该批次已有二维码，无需重复生成。");
      await Promise.all([loadBatches(), loadQrItems()]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成二维码失败。");
    } finally {
      setGeneratingBatchId(null);
    }
  }

  function focusBatchQrItems(batchId: string, syncUrl = true) {
    setSelectedBatchId(batchId);
    setSelectedStatus("ALL");
    setKeyword("");
    setQrItems([]);
    setSelectedQrItemId(null);
    setSelectedQrItemDetail(null);

    if (syncUrl) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("batchId", batchId);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    const queryBatchId = searchParams.get("batchId") ?? undefined;

    if (queryBatchId && queryBatchId !== selectedBatchId) {
      focusBatchQrItems(queryBatchId, false);
    }
  }, [searchParams, selectedBatchId]);

  useEffect(() => {
    void loadQrItems();
  }, [selectedBatchId, selectedStatus]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadQrItems();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    if (selectedQrItemId) {
      void loadQrItemDetail(selectedQrItemId);
    } else {
      setSelectedQrItemDetail(null);
    }
  }, [selectedQrItemId]);

  const columns: ColumnsType<QrItemListRecord> = [
    {
      title: "二维码编号",
      dataIndex: "qrCode",
      width: 260
    },
    {
      title: "批次号",
      key: "batchNo",
      width: 180,
      render: (_, record) => record.batch.batchNo
    },
    {
      title: "关联合同",
      key: "contractNo",
      width: 180,
      render: (_, record) => record.contract?.contractNo ?? "-"
    },
    {
      title: "序号",
      dataIndex: "serialNo",
      width: 100
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 140,
      render: (value: string) => <Tag color={qrStatusColorMap[value] ?? "default"}>{value}</Tag>
    },
    {
      title: "仓库",
      dataIndex: "currentWarehouse",
      width: 180,
      render: (value: string | null) => value ?? "-"
    }
  ];

  return (
    <div className="document-workspace">
      <section className="page-hero">
        <h2>二维码追溯</h2>
        <p>
          这里是阶段 5 的核心页面。它默认进入最新批次的追溯视角，负责生成真实二维码、展示单个二维码生命周期，并为阶段 6 的扫码入库和阶段 8 的库存统计提供真实数据基础。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={6}>
          <Card className="stat-card">
            <Statistic title="当前列表二维码" value={totalQrCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card className="stat-card">
            <Statistic title="待入库" value={pendingInboundCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card className="stat-card">
            <Statistic title="在库" value={inStockCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Card className="stat-card">
            <Statistic title="已出库" value={outboundCount} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Alert
        style={{ marginTop: 20 }}
        type="info"
        showIcon
        message="阶段 5 规则"
        description="本阶段只生成 QrItem 和二维码图片，不会增加库存。只有后续扫码入库把状态从 PENDING_INBOUND 变为 IN_STOCK 后，库存才会真正增加。"
      />

      <Card className="placeholder-card" style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text strong>选择批次</Typography.Text>
              <Select
                loading={isBatchesLoading}
                value={selectedBatchId}
                placeholder="请选择一个正式批次"
                options={batches.map((batch) => ({
                  value: batch.id,
                  label: `${batch.batchNo} · ${batch.productName} · ${batch.totalQuantity}${batch.unit}`
                }))}
                onChange={(value) => focusBatchQrItems(value)}
                style={{ width: "100%" }}
              />
            </Space>
          </Col>
          <Col xs={24} md={5}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text strong>状态筛选</Typography.Text>
              <Select
                value={selectedStatus}
                options={qrStatusOptions}
                onChange={(value) => setSelectedStatus(value)}
                style={{ width: "100%" }}
              />
            </Space>
          </Col>
          <Col xs={24} md={7}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text strong>关键字</Typography.Text>
              <Input
                value={keyword}
                placeholder="搜二维码编号 / 批次号 / 合同号"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Space>
          </Col>
          <Col xs={24} md={4}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text strong>操作</Typography.Text>
              <Button icon={<ReloadOutlined />} onClick={() => void Promise.all([loadBatches(), loadQrItems()])}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedBatch ? (
        <Card className="placeholder-card" style={{ marginTop: 20 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: "batchNo", label: "当前批次", children: selectedBatch.batchNo },
                {
                  key: "product",
                  label: "商品与数量",
                  children: `${selectedBatch.productName} · ${selectedBatch.totalQuantity}${selectedBatch.unit}`
                },
                {
                  key: "qrSummary",
                  label: "二维码进度",
                  children:
                    selectedBatch.qrSummary.total > 0
                      ? `已生成 ${selectedBatch.qrSummary.total} 个二维码`
                      : "尚未生成二维码"
                }
              ]}
            />

            <Space wrap>
              {selectedBatch.qrSummary.total > 0 ? (
                <Button type="primary" onClick={() => focusBatchQrItems(selectedBatch.id)}>
                  查看当前批次二维码
                </Button>
              ) : (
                <Button
                  type="primary"
                  loading={generatingBatchId === selectedBatch.id}
                  onClick={() => void handleGenerateQrItems(selectedBatch.id)}
                >
                  生成本批次二维码
                </Button>
              )}
            </Space>
          </Space>
        </Card>
      ) : null}

      <Row gutter={[20, 20]} align="top" style={{ marginTop: 20 }}>
        <Col xs={24} xl={14}>
          <Card className="placeholder-card document-table-card" title="二维码列表">
            <Table<QrItemListRecord>
              rowKey="id"
              loading={isItemsLoading}
              columns={columns}
              dataSource={qrItems}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              scroll={{ x: 1100 }}
              rowClassName={(record) => (record.id === selectedQrItemId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedQrItemId(record.id)
              })}
              locale={{
                emptyText: (
                  <Empty description="当前条件下还没有二维码。请先选择批次并点击“生成本批次二维码”。" />
                )
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="placeholder-card document-detail-card" title="二维码详情" loading={isDetailLoading}>
            {selectedQrItemDetail ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: "qrCode", label: "二维码编号", children: selectedQrItemDetail.qrCode },
                    { key: "serialNo", label: "序号", children: selectedQrItemDetail.serialNo },
                    {
                      key: "status",
                      label: "当前状态",
                      children: <Tag color={qrStatusColorMap[selectedQrItemDetail.status] ?? "default"}>{selectedQrItemDetail.status}</Tag>
                    },
                    { key: "batchNo", label: "批次号", children: selectedQrItemDetail.batch.batchNo },
                    { key: "contractNo", label: "合同号", children: selectedQrItemDetail.contract?.contractNo ?? "-" },
                    { key: "product", label: "商品", children: selectedQrItemDetail.productName ?? "-" },
                    { key: "warehouse", label: "当前仓库", children: selectedQrItemDetail.currentWarehouse ?? "-" },
                    { key: "createdAt", label: "生成时间", children: formatDateTime(selectedQrItemDetail.createdAt) },
                    { key: "inboundAt", label: "入库时间", children: formatDateTime(selectedQrItemDetail.inboundAt) },
                    { key: "outboundAt", label: "出库时间", children: formatDateTime(selectedQrItemDetail.outboundAt) }
                  ]}
                />

                <div>
                  <Typography.Text strong>二维码图片</Typography.Text>
                  <div style={{ marginTop: 12 }}>
                    <Image
                      width={240}
                      src={resolveApiUrl(selectedQrItemDetail.imageUrl)}
                      alt={selectedQrItemDetail.qrCode}
                    />
                  </div>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                    当前二维码图片来自后端真实生成的 SVG 文件。
                  </Typography.Paragraph>
                </div>

                <div>
                  <Typography.Text strong>生命周期流水</Typography.Text>
                  {selectedQrItemDetail.stockMovements.length > 0 ? (
                    <Table
                      style={{ marginTop: 12 }}
                      size="small"
                      rowKey="id"
                      pagination={false}
                      dataSource={selectedQrItemDetail.stockMovements}
                      columns={[
                        {
                          title: "动作",
                          dataIndex: "movementType",
                          width: 120
                        },
                        {
                          title: "状态变化",
                          key: "statusFlow",
                          render: (_, record) => `${record.fromStatus ?? "-"} → ${record.toStatus ?? "-"}`
                        },
                        {
                          title: "时间",
                          key: "occurredAt",
                          width: 180,
                          render: (_, record) => formatDateTime(record.occurredAt)
                        }
                      ]}
                    />
                  ) : (
                    <Alert
                      style={{ marginTop: 12 }}
                      type="warning"
                      showIcon
                      message="当前还没有库存流水"
                      description="这是正常现象。阶段 5 只生成二维码，阶段 6 扫码入库后这里才会开始出现生命周期流水。"
                    />
                  )}
                </div>
              </Space>
            ) : (
              <Empty description="从左侧选择一个二维码后，这里会展示二维码图片和生命周期明细。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
