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
  qrItems: Array<{
    id: string;
    status: string;
  }>;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
};

type BatchDetail = {
  id: string;
  batchNo: string;
  contractId: string;
  skuId: string | null;
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
    fileUrl: string | null;
  } | null;
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    amount: number;
    currency: string;
  };
  qrItems: Array<{
    id: string;
    qrCode: string;
    serialNo: number;
    status: string;
    createdAt: string;
  }>;
  stockMovements: Array<{
    id: string;
    movementType: string;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    occurredAt: string;
  }>;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
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
  const [generatingBatchId, setGeneratingBatchId] = useState<string | null>(null);

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

  async function handleGenerateQr(batchId: string) {
    setGeneratingBatchId(batchId);

    try {
      const result = await requestJson<{ created: boolean; message: string }>("/api/qr-items/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ batchId })
      });

      message.success(result.created ? "本批次二维码已生成。" : "该批次已经生成过二维码。");
      await Promise.all([loadBatches(), loadBatchDetail(batchId)]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成二维码失败。");
    } finally {
      setGeneratingBatchId(null);
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
      width: 200,
      render: (_, record) =>
        record.qrSummary.total > 0
          ? `总码 ${record.qrSummary.total} / 在库 ${record.qrSummary.inStock}`
          : "尚未生成二维码"
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
        <h2>正式批次数据</h2>
        <p>
          这里展示的是由正式合同生成的货物批次。当前阶段批次已经接入二维码、扫码入库 / 出库和真实库存统计，库存变化只来自二维码状态流转。
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
            message="阶段 8 真实库存规则"
            description="批次数量只是业务目标量，不等于当前库存。只有二维码状态从待入库变为在库、再从在库变为已出库后，库存统计才会变化。"
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
              scroll={{ x: 1200 }}
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
                    {
                      key: "warehouse",
                      label: "目的仓库",
                      children: selectedBatchDetail.destinationWarehouse
                    },
                    {
                      key: "document",
                      label: "来源单据",
                      children: selectedBatchDetail.sourceDocument?.originalName ?? "-"
                    }
                  ]}
                />

                <Alert
                  type="info"
                  showIcon
                  message="当前二维码与库存状态"
                  description={`已生成二维码 ${selectedBatchDetail.qrSummary.total} 个；在途 ${selectedBatchDetail.qrSummary.pendingInbound} 个；在库 ${selectedBatchDetail.qrSummary.inStock} 个；已出库 ${selectedBatchDetail.qrSummary.outbound} 个。`}
                />

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
                      loading={generatingBatchId === selectedBatchDetail.id}
                      onClick={() => void handleGenerateQr(selectedBatchDetail.id)}
                    >
                      生成本批次二维码
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
                    locale={{ emptyText: "当前批次还没有二维码，先点击“生成本批次二维码”。" }}
                    dataSource={selectedBatchDetail.qrItems}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.qrCode}</div>
                          <div className="documents-secondary-text">
                            序号 {item.serialNo} · {item.status} · {formatDateTime(item.createdAt)}
                          </div>
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
                    locale={{ emptyText: "当前批次还没有库存流水，先去仓储管理完成扫码入库或扫码出库。" }}
                    dataSource={selectedBatchDetail.stockMovements}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.movementType}</div>
                          <div className="documents-secondary-text">
                            {item.fromStatus ?? "-"} → {item.toStatus ?? "-"} · {formatDateTime(item.occurredAt)}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            ) : (
              <Empty description="从左侧选择一个批次后，这里会展示二维码准备状态和库存流水。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
