import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { QrcodeOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type HierarchySummary = {
  unitCount: number;
  boxCount: number;
  palletCount: number;
};

type BatchListRecord = {
  id: string;
  batchNo: string;
  contractId: string;
  sku: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  destinationWarehouse: string;
  warehouseId: string | null;
  status: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDocument: {
    id: string;
    originalName: string | null;
  } | null;
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
  };
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
  hierarchySummary: HierarchySummary;
};

type BatchDetail = BatchListRecord & {
  skuId: string | null;
  sourceDocument: {
    id: string;
    originalName: string | null;
    fileUrl: string | null;
  } | null;
  contract: BatchListRecord["contract"] & {
    amount: number;
    currency: string;
  };
  qrItems: Array<{
    id: string;
    qrCode: string;
    serialNo: number;
    status: string;
    createdAt: string;
    unitTraceCode: string | null;
    boxTraceCode: string | null;
    palletTraceCode: string | null;
    freezeReason: string | null;
    statusRemark: string | null;
  }>;
  stockMovements: Array<{
    id: string;
    movementType: string;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    occurredAt: string;
  }>;
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

export function BatchesPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchListRecord[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const selectedBatch = useMemo(
    () => batches.find((item) => item.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  async function loadBatches() {
    setIsLoading(true);

    try {
      const data = await requestJson<BatchListRecord[]>("/api/batches");
      setBatches(data);

      if (!selectedBatchId && data.length > 0) {
        setSelectedBatchId(data[0].id);
      }

      if (selectedBatchId && !data.some((item) => item.id === selectedBatchId)) {
        setSelectedBatchId(data[0]?.id ?? null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载批次列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBatchDetail(batchId: string) {
    setIsDetailLoading(true);

    try {
      const detail = await requestJson<BatchDetail>(`/api/batches/${batchId}`);
      setSelectedBatchDetail(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载批次详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function openBatchQrItems(batchId: string) {
    navigate(`/qr-items?batchId=${encodeURIComponent(batchId)}`);
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      void loadBatchDetail(selectedBatchId);
    } else {
      setSelectedBatchDetail(null);
    }
  }, [selectedBatchId]);

  const columns: ColumnsType<BatchListRecord> = [
    {
      title: "批次号",
      dataIndex: "batchNo",
      width: 220
    },
    {
      title: "关联合同",
      key: "contract",
      width: 220,
      render: (_, record) => record.contract.contractNo
    },
    {
      title: "商品",
      dataIndex: "productName",
      width: 180
    },
    {
      title: "数量",
      key: "quantity",
      width: 140,
      render: (_, record) => `${record.totalQuantity}${record.unit}`
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 150,
      render: (value: string) => <Tag color="processing">{value}</Tag>
    },
    {
      title: "二维码状态",
      key: "qrSummary",
      width: 220,
      render: (_, record) =>
        record.qrSummary.total > 0
          ? `总码 ${record.qrSummary.total} / 在库 ${record.qrSummary.inStock} / 出库 ${record.qrSummary.outbound}`
          : "尚未生成二维码"
    },
    {
      title: "多级码",
      key: "hierarchySummary",
      width: 220,
      render: (_, record) =>
        `箱码 ${record.hierarchySummary.boxCount} / 托盘码 ${record.hierarchySummary.palletCount}`
    },
    {
      title: "来源单据",
      key: "sourceDocument",
      width: 220,
      render: (_, record) => record.sourceDocument?.originalName ?? "-"
    }
  ];

  return (
    <div className="document-workspace">
      <section className="page-hero">
        <h2>批次追踪中心</h2>
        <p>
          批次不是独立业务操作模块，而是贯穿合同、采购、物流、清关、仓储、销售和库存的追踪线索。
          这里用于查看批次全链路状态，具体业务动作应回到对应模块执行。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="正式批次数" value={batches.length} suffix="个" />
            </Card>
            <Card className="stat-card">
              <Statistic
                title="已生成二维码"
                value={batches.reduce((sum, item) => sum + item.qrSummary.total, 0)}
                suffix="个"
              />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={16}>
          <Alert
            type="info"
            showIcon
            message="批次是追踪对象，不是独立处理岗位"
            description="合同与单据生成批次；采购、物流、清关、仓储、销售引用批次推进业务；二维码追溯和库存统计按批次查询真实状态。批次数量仍是计划执行数量，库存只由 QrItem.status 与 StockMovement 计算。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} xl={14}>
          <Card
            className="placeholder-card document-table-card"
            title="批次列表"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadBatches()}>
                刷新
              </Button>
            }
          >
            <Table<BatchListRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={batches}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1420 }}
              rowClassName={(record) => (record.id === selectedBatchId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedBatchId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有正式批次。请先在“合同与单据”中确认生成业务数据。" />
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="placeholder-card document-detail-card" title="批次详情" loading={isDetailLoading}>
            {selectedBatchDetail && selectedBatch ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: "batchNo", label: "批次号", children: selectedBatchDetail.batchNo },
                    { key: "contract", label: "关联合同", children: selectedBatchDetail.contract.contractNo },
                    { key: "product", label: "商品", children: selectedBatchDetail.productName },
                    { key: "sku", label: "SKU", children: selectedBatchDetail.sku },
                    {
                      key: "quantity",
                      label: "批次数量",
                      children: `${selectedBatchDetail.totalQuantity}${selectedBatchDetail.unit}`
                    },
                    { key: "warehouse", label: "目的仓库", children: selectedBatchDetail.destinationWarehouse },
                    { key: "document", label: "来源单据", children: selectedBatchDetail.sourceDocument?.originalName ?? "-" }
                  ]}
                />

                <Alert
                  type="info"
                  showIcon
                  message="当前二维码与库存状态"
                  description={`已生成二维码 ${selectedBatchDetail.qrSummary.total} 个；待入库 ${selectedBatchDetail.qrSummary.pendingInbound} 个；在库 ${selectedBatchDetail.qrSummary.inStock} 个；已出库 ${selectedBatchDetail.qrSummary.outbound} 个。`}
                />

                <div className="document-summary-grid warehouse-mini-grid">
                  <Card className="stat-card">
                    <Statistic title="最小包装码" value={selectedBatchDetail.hierarchySummary.unitCount} suffix="个" />
                  </Card>
                  <Card className="stat-card">
                    <Statistic title="箱码" value={selectedBatchDetail.hierarchySummary.boxCount} suffix="个" />
                  </Card>
                  <Card className="stat-card">
                    <Statistic title="托盘码" value={selectedBatchDetail.hierarchySummary.palletCount} suffix="个" />
                  </Card>
                  <Card className="stat-card">
                    <Statistic title="库存流水" value={selectedBatchDetail.stockMovements.length} suffix="条" />
                  </Card>
                </div>

                <Space wrap>
                  {selectedBatchDetail.qrSummary.total > 0 ? (
                    <Button
                      type="primary"
                      icon={<QrcodeOutlined />}
                      onClick={() => openBatchQrItems(selectedBatchDetail.id)}
                    >
                      查看本批次二维码
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      icon={<QrcodeOutlined />}
                      onClick={() => openBatchQrItems(selectedBatchDetail.id)}
                    >
                      去二维码追溯生成二维码
                    </Button>
                  )}
                  <Button icon={<QrcodeOutlined />} onClick={() => navigate("/qr-items")}>
                    查看二维码追溯
                  </Button>
                </Space>

                <div>
                  <Typography.Text strong>二维码准备状态</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "当前批次还没有二维码。请到“二维码追溯”选择该批次并生成二维码。" }}
                    dataSource={selectedBatchDetail.qrItems}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <Space wrap>
                            <strong>{item.qrCode}</strong>
                            <Tag color={qrStatusColorMap[item.status] ?? "default"}>{item.status}</Tag>
                          </Space>
                          <div className="documents-secondary-text">
                            序号 {item.serialNo} · 箱码 {item.boxTraceCode ?? "-"} · 托盘码 {item.palletTraceCode ?? "-"}
                          </div>
                          {item.freezeReason || item.statusRemark ? (
                            <div className="documents-secondary-text">
                              冻结/备注：{item.freezeReason ?? item.statusRemark}
                            </div>
                          ) : null}
                        </div>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Text strong>库存流水</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "当前批次还没有库存流水，请先去仓储管理完成扫码入库、出库或冻结解冻。" }}
                    dataSource={selectedBatchDetail.stockMovements}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.movementType}</div>
                          <div className="documents-secondary-text">
                            {item.fromStatus ?? "-"} {"->"} {item.toStatus ?? "-"} · {formatDateTime(item.occurredAt)}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            ) : (
              <Empty description="从左侧选择一个批次后，这里会展示二维码准备状态、多级码结构和库存流水。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
