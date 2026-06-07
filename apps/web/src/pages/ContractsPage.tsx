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

type ContractListRecord = {
  id: string;
  contractNo: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  supplierName: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
  destinationWarehouse: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDocument: {
    id: string;
    originalName: string | null;
  } | null;
  batches: Array<{
    id: string;
    batchNo: string;
    status: string;
  }>;
  payments: Array<{
    id: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
  }>;
  receivable: {
    id: string;
    amount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
  } | null;
};

type ContractDetail = {
  id: string;
  contractNo: string;
  contractType: string;
  status: string;
  paymentStatus: string;
  customerId: string | null;
  customerName: string;
  supplierId: string | null;
  supplierName: string;
  companyId: string | null;
  productName: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
  destinationWarehouse: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDocument: {
    id: string;
    originalName: string | null;
    fileUrl: string | null;
  } | null;
  batches: Array<{
    id: string;
    batchNo: string;
    status: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
    createdAt: string;
  }>;
  items: Array<{
    id: string;
    skuCode: string;
    skuName: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    amount: number | null;
    currency: string | null;
  }>;
  purchaseOrders: Array<{
    id: string;
    purchaseNo: string;
    status: string;
    supplierName: string;
    skuName: string;
    quantity: number;
    unit: string;
    deliveryDate: string | null;
    createdAt: string;
  }>;
  receivables: Array<{
    id: string;
    amount: number;
    currency: string;
    receivedAmount: number;
    status: string;
    dueDate: string | null;
    createdAt: string;
  }>;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<ContractListRecord[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContractDetail, setSelectedContractDetail] = useState<ContractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const selectedContract = useMemo(
    () => contracts.find((item) => item.id === selectedContractId) ?? null,
    [contracts, selectedContractId]
  );

  async function loadContracts() {
    setIsLoading(true);

    try {
      const data = await requestJson<ContractListRecord[]>("/api/contracts");
      setContracts(data);

      if (!selectedContractId && data.length > 0) {
        setSelectedContractId(data[0].id);
      }

      if (selectedContractId && !data.some((item) => item.id === selectedContractId)) {
        setSelectedContractId(data[0]?.id ?? null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载合同列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContractDetail(contractId: string) {
    setIsDetailLoading(true);

    try {
      const detail = await requestJson<ContractDetail>(`/api/contracts/${contractId}`);
      setSelectedContractDetail(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载合同详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      void loadContractDetail(selectedContractId);
    } else {
      setSelectedContractDetail(null);
    }
  }, [selectedContractId]);

  const columns: ColumnsType<ContractListRecord> = [
    {
      title: "合同号",
      dataIndex: "contractNo",
      width: 220
    },
    {
      title: "客户",
      dataIndex: "customerName",
      width: 180
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
      title: "金额",
      key: "amount",
      width: 180,
      render: (_, record) => formatAmount(record.amount, record.currency)
    },
    {
      title: "合同状态",
      dataIndex: "status",
      width: 130,
      render: (value: string) => <Tag color="processing">{value}</Tag>
    },
    {
      title: "回款状态",
      dataIndex: "paymentStatus",
      width: 130,
      render: (value: string) => <Tag color="warning">{value}</Tag>
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
        <h2>正式合同数据</h2>
        <p>
          这里展示的是用户在“合同与单据”页面确认后写入数据库的正式业务数据。它已经不再是识别草稿，
          但此时仍然不会形成库存，库存要等二维码生成并扫码入库后才会产生。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="正式合同数" value={contracts.length} suffix="份" />
            </Card>
            <Card className="stat-card">
              <Statistic
                title="已关联批次数"
                value={contracts.reduce((sum, item) => sum + item.batches.length, 0)}
                suffix="个"
              />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={16}>
          <Alert
            type="info"
            showIcon
            message="阶段 4 规则"
            description="当前页面只展示正式合同、合同明细、采购草稿和应收草稿。没有任何库存写入，合同数量不能直接等于库存数量。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} xxl={14}>
          <Card
            className="placeholder-card"
            title="合同列表"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadContracts()}>
                刷新
              </Button>
            }
          >
            <Table<ContractListRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={contracts}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1200 }}
              rowClassName={(record) => (record.id === selectedContractId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedContractId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有正式合同。请先在“合同与单据”中确认生成业务数据。" />
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xxl={10}>
          <Card className="placeholder-card" title="合同详情" loading={isDetailLoading}>
            {selectedContractDetail && selectedContract ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: "contractNo", label: "合同号", children: selectedContractDetail.contractNo },
                    { key: "customer", label: "客户", children: selectedContractDetail.customerName },
                    { key: "supplier", label: "供应商", children: selectedContractDetail.supplierName },
                    { key: "product", label: "商品", children: selectedContractDetail.productName },
                    {
                      key: "quantity",
                      label: "合同数量",
                      children: `${selectedContractDetail.totalQuantity}${selectedContractDetail.unit}`
                    },
                    {
                      key: "amount",
                      label: "合同金额",
                      children: formatAmount(selectedContractDetail.amount, selectedContractDetail.currency)
                    },
                    {
                      key: "warehouse",
                      label: "目的仓库",
                      children: selectedContractDetail.destinationWarehouse
                    },
                    {
                      key: "document",
                      label: "来源单据",
                      children: selectedContractDetail.sourceDocument?.originalName ?? "-"
                    }
                  ]}
                />

                <Alert
                  type="warning"
                  showIcon
                  message="库存尚未生成"
                  description="当前合同已经是正式业务数据，但系统还没有创建二维码，更没有扫码入库，所以库存仍然应该为 0。"
                />

                <div>
                  <Typography.Text strong>合同明细</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无合同明细。" }}
                    dataSource={selectedContractDetail.items}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.skuName}</div>
                          <div className="documents-secondary-text">
                            {item.skuCode} · {item.quantity}
                            {item.unit} · {formatAmount(item.amount, item.currency)}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Text strong>关联批次</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无关联批次。" }}
                    dataSource={selectedContractDetail.batches}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.batchNo}</div>
                          <div className="documents-secondary-text">
                            {item.productName} · {item.totalQuantity}
                            {item.unit} · {item.status}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Text strong>采购草稿与应收草稿</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无采购或应收草稿。" }}
                    dataSource={[
                      ...selectedContractDetail.purchaseOrders.map((item) => ({
                        id: item.id,
                        title: `采购草稿 ${item.purchaseNo}`,
                        subtitle: `${item.skuName} · ${item.quantity}${item.unit} · ${item.status}`
                      })),
                      ...selectedContractDetail.receivables.map((item) => ({
                        id: item.id,
                        title: `应收草稿 ${formatAmount(item.amount, item.currency)}`,
                        subtitle: `${item.status} · 到期 ${formatDateTime(item.dueDate)}`
                      }))
                    ]}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.title}</div>
                          <div className="documents-secondary-text">{item.subtitle}</div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            ) : (
              <Empty description="从左侧选择一份合同后，这里会展示合同详情、合同明细和采购草稿。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
