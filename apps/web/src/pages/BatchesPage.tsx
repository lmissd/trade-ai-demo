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
import { ReloadOutlined } from "@ant-design/icons";
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
          这里展示的是由正式合同生成的货物批次。当前阶段批次已经准备好进入二维码生成，但还没有任何二维码，也没有库存。
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
            type="warning"
            showIcon
            message="阶段 4 规则"
            description="当前批次已经正式落库，但还没有二维码。库存必须等阶段 5 生成 QrItem、阶段 6 扫码入库后才会产生。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} xxl={14}>
          <Card
            className="placeholder-card"
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

        <Col xs={24} xxl={10}>
          <Card className="placeholder-card" title="批次详情" loading={isDetailLoading}>
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
                  description={`已生成二维码 ${selectedBatchDetail.qrSummary.total} 个；在库 ${selectedBatchDetail.qrSummary.inStock} 个；待入库 ${selectedBatchDetail.qrSummary.pendingInbound} 个。当前阶段正常情况下应全部为 0。`}
                />

                <div>
                  <Typography.Text strong>二维码准备状态</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "阶段 5 开始后，这里才会出现二维码明细。" }}
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
                    locale={{ emptyText: "阶段 6 和阶段 7 扫码后，这里才会出现库存流水。" }}
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
