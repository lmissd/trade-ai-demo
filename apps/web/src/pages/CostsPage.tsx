import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Grid,
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
import { CarOutlined, DollarCircleOutlined, ReloadOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type StatusMeta = {
  code: "DEMO_ESTIMATE" | "MANUAL_DRAFT";
  label: string;
  color: "default" | "processing" | "success";
  summary: string;
};

type ContractSnapshot = {
  id: string;
  contractNo: string;
  customerName: string;
  supplierName: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
  destinationWarehouse: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type BatchSnapshot = {
  id: string;
  batchNo: string;
  sku: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  destinationWarehouse: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null;

type SalesOrderSnapshot = {
  id: string;
  salesNo: string;
  customerName: string;
  skuName: string;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
  deliveryStatus: string;
  signStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null;

type ReceivableSnapshot = {
  id: string;
  contractId: string | null;
  salesOrderId: string | null;
  amount: number;
  currency: string;
  dueDate: string | null;
  receivedAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null;

type PaymentSnapshot = {
  id: string;
  contractId: string;
  receivableAmount: number;
  receivedAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

type PurchaseOrderSnapshot = {
  id: string;
  contractId: string | null;
  purchaseNo: string;
  supplierName: string;
  skuName: string;
  quantity: number;
  unit: string;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null;

type ShipmentSnapshot = {
  id: string;
  contractId: string | null;
  batchId: string | null;
  shipmentNo: string;
  shippingCompany: string | null;
  billOfLadingNo: string | null;
  containerNo: string | null;
  originPort: string | null;
  destinationPort: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
} | null;

type CostLine = {
  key: string;
  costType: string;
  label: string;
  amount: number;
  currency: string;
  exchangeRateToCny: number;
  baseCurrencyAmount: number;
  remark: string;
  source: "DEMO_TEMPLATE" | "MANUAL_ENTRY";
};

type ExchangeRateSnapshot = {
  currency: string;
  rateToCny: number;
  source: "fallback" | "manual";
};

type CostTotals = {
  salesAmount: number;
  salesCurrency: string;
  salesAmountBaseCny: number;
  totalCostBaseCny: number;
  totalCostInSalesCurrency: number;
  grossProfitBaseCny: number;
  grossProfitInSalesCurrency: number;
  grossMargin: number;
};

type CostRecord = {
  id: string;
  isDemoData: boolean;
  statusMeta: StatusMeta;
  contract: ContractSnapshot;
  batch: BatchSnapshot;
  salesOrder: SalesOrderSnapshot;
  receivable: ReceivableSnapshot;
  totals: CostTotals;
  costPreview: CostLine[];
};

type CostDetail = {
  id: string;
  isDemoData: boolean;
  statusMeta: StatusMeta;
  contract: ContractSnapshot;
  batch: BatchSnapshot;
  purchaseOrder: PurchaseOrderSnapshot;
  shipment: ShipmentSnapshot;
  salesOrder: SalesOrderSnapshot;
  payment: PaymentSnapshot;
  receivable: ReceivableSnapshot;
  totals: CostTotals;
  costBreakdown: CostLine[];
  exchangeRates: ExchangeRateSnapshot[];
  moduleNarrative: {
    role: string;
    boundary: string;
  };
  history: Array<{
    id: string;
    action: string;
    operator: string;
    occurredAt: string;
    summary: string;
  }>;
};

type CostsResponse = {
  summary: {
    totalContracts: number;
    demoContracts: number;
    manualContracts: number;
    totalSalesBaseCny: number;
    totalCostBaseCny: number;
    totalGrossProfitBaseCny: number;
    averageGrossMargin: number;
  };
  records: CostRecord[];
};

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function renderStatusTag(statusMeta: StatusMeta) {
  return <Tag color={statusMeta.color}>{statusMeta.label}</Tag>;
}

export function CostsPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CostsResponse["summary"] | null>(null);
  const [records, setRecords] = useState<CostRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? null,
    [records, selectedId]
  );

  async function loadCosts() {
    setIsLoading(true);

    try {
      const payload = await requestJson<CostsResponse>("/api/costs/contracts");
      setSummary(payload.summary);
      setRecords(payload.records);

      if (selectedId && !payload.records.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setSelectedDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载成本利润列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(recordId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<CostDetail>(`/api/costs/contracts/${recordId}`);
      setSelectedDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载成本利润详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadCosts();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    setSelectedDetail(null);
    void loadDetail(selectedId);
  }, [selectedId]);

  const columns: ColumnsType<CostRecord> = [
    {
      title: "合同 / 批次",
      key: "contract",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.contract.contractNo}</Typography.Text>
          <Typography.Text type="secondary">{record.batch?.batchNo ?? "待生成批次"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "商品 / 数量",
      key: "product",
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.contract.productName}</Typography.Text>
          <Typography.Text type="secondary">
            {record.contract.totalQuantity}
            {record.contract.unit} / {record.contract.destinationWarehouse}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: "销售金额",
      key: "salesAmount",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{formatAmount(record.totals.salesAmount, record.totals.salesCurrency)}</Typography.Text>
          <Typography.Text type="secondary">{formatAmount(record.totals.salesAmountBaseCny, "CNY")}</Typography.Text>
        </Space>
      )
    },
    {
      title: "总成本",
      key: "totalCost",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{formatAmount(record.totals.totalCostInSalesCurrency, record.totals.salesCurrency)}</Typography.Text>
          <Typography.Text type="secondary">{formatAmount(record.totals.totalCostBaseCny, "CNY")}</Typography.Text>
        </Space>
      )
    },
    {
      title: "预计毛利",
      key: "grossProfit",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{formatAmount(record.totals.grossProfitInSalesCurrency, record.totals.salesCurrency)}</Typography.Text>
          <Typography.Text type="secondary">{formatAmount(record.totals.grossProfitBaseCny, "CNY")}</Typography.Text>
        </Space>
      )
    },
    {
      title: "毛利率",
      dataIndex: ["totals", "grossMargin"],
      width: 120,
      render: (value: number) => <Tag color={value >= 20 ? "success" : "warning"}>{value}%</Tag>
    },
    {
      title: "口径状态",
      key: "status",
      width: 140,
      render: (_, record) => renderStatusTag(record.statusMeta)
    },
    {
      title: "成本结构预览",
      key: "preview",
      width: 260,
      render: (_, record) => (
        <Space wrap>
          {record.costPreview.map((item) => (
            <Tag key={item.key}>{item.label}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_, record) => (
        <Button type="link" onClick={() => setSelectedId(record.id)}>
          查看测算
        </Button>
      )
    }
  ];

  const breakdownColumns: ColumnsType<CostLine> = [
    {
      title: "成本项",
      dataIndex: "label",
      width: 160
    },
    {
      title: "原始金额",
      key: "amount",
      width: 160,
      render: (_, record) => formatAmount(record.amount, record.currency)
    },
    {
      title: "汇率",
      dataIndex: "exchangeRateToCny",
      width: 120,
      render: (value: number) => `${value} -> CNY`
    },
    {
      title: "折算人民币",
      dataIndex: "baseCurrencyAmount",
      width: 180,
      render: (value: number) => formatAmount(value, "CNY")
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 120,
      render: (value: CostLine["source"]) => (
        <Tag color={value === "DEMO_TEMPLATE" ? "processing" : "success"}>
          {value === "DEMO_TEMPLATE" ? "Demo 模板" : "手工录入"}
        </Tag>
      )
    },
    {
      title: "说明",
      dataIndex: "remark"
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="成本利润为 Demo 演示数据，正式版将按真实费用单据和财务规则核算。"
        description="当前页面优先复用真实合同、批次、销售与应收上下文；如果尚未录入成本项，系统会自动套用演示版多币种成本模板。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="合同测算数" value={summary?.totalContracts ?? 0} suffix="票" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Demo 测算口径" value={summary?.demoContracts ?? 0} suffix="票" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="总成本" value={summary?.totalCostBaseCny ?? 0} precision={2} suffix="CNY" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="预计毛利率" value={summary?.averageGrossMargin ?? 0} precision={2} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card>
            <Statistic title="销售收入汇总" value={summary?.totalSalesBaseCny ?? 0} precision={2} suffix="CNY" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card>
            <Statistic title="预计毛利汇总" value={summary?.totalGrossProfitBaseCny ?? 0} precision={2} suffix="CNY" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card>
            <Statistic title="已录入手工成本" value={summary?.manualContracts ?? 0} suffix="票" />
          </Card>
        </Col>
      </Row>

      <Card
        title="合同成本利润测算"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadCosts()}>
            刷新测算
          </Button>
        }
      >
        {records.length > 0 ? (
          <Table<CostRecord>
            rowKey="id"
            loading={isLoading}
            dataSource={records}
            columns={columns}
            pagination={false}
            scroll={{ x: 1560 }}
          />
        ) : (
          <Empty description="当前还没有正式合同，先去“合同与单据”生成业务数据后再看成本利润。" />
        )}
      </Card>

      <Drawer
        title={selectedRecord ? `成本利润详情 · ${selectedRecord.contract.contractNo}` : "成本利润详情"}
        placement="right"
        width={screens.xs ? "100%" : 820}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      >
        {selectedDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type={selectedDetail.isDemoData ? "warning" : "success"}
              showIcon
              message={selectedDetail.statusMeta.label}
              description={selectedDetail.statusMeta.summary}
            />

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    title="销售金额"
                    value={selectedDetail.totals.salesAmount}
                    precision={2}
                    suffix={selectedDetail.totals.salesCurrency}
                  />
                  <Typography.Text type="secondary">
                    折算人民币：{formatAmount(selectedDetail.totals.salesAmountBaseCny, "CNY")}
                  </Typography.Text>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    title="总成本"
                    value={selectedDetail.totals.totalCostInSalesCurrency}
                    precision={2}
                    suffix={selectedDetail.totals.salesCurrency}
                  />
                  <Typography.Text type="secondary">
                    折算人民币：{formatAmount(selectedDetail.totals.totalCostBaseCny, "CNY")}
                  </Typography.Text>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    title="预计毛利"
                    value={selectedDetail.totals.grossProfitInSalesCurrency}
                    precision={2}
                    suffix={selectedDetail.totals.salesCurrency}
                  />
                  <Typography.Text type="secondary">
                    折算人民币：{formatAmount(selectedDetail.totals.grossProfitBaseCny, "CNY")}
                  </Typography.Text>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic title="毛利率" value={selectedDetail.totals.grossMargin} precision={2} suffix="%" />
                  <Typography.Text type="secondary">当前为合同 / 销售口径的预计利润率。</Typography.Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card title="合同与执行上下文">
                  <Descriptions column={1} size="small" items={[
                    {
                      key: "contractNo",
                      label: "合同号",
                      children: selectedDetail.contract.contractNo
                    },
                    {
                      key: "batchNo",
                      label: "批次号",
                      children: selectedDetail.batch?.batchNo ?? "-"
                    },
                    {
                      key: "product",
                      label: "商品 / 数量",
                      children: `${selectedDetail.contract.productName} / ${selectedDetail.contract.totalQuantity}${selectedDetail.contract.unit}`
                    },
                    {
                      key: "customer",
                      label: "客户",
                      children: selectedDetail.contract.customerName
                    },
                    {
                      key: "supplier",
                      label: "供应商",
                      children: selectedDetail.contract.supplierName
                    },
                    {
                      key: "warehouse",
                      label: "目的仓库",
                      children: selectedDetail.contract.destinationWarehouse
                    },
                    {
                      key: "salesOrder",
                      label: "销售单",
                      children: selectedDetail.salesOrder?.salesNo ?? "-"
                    },
                    {
                      key: "purchaseOrder",
                      label: "采购单",
                      children: selectedDetail.purchaseOrder?.purchaseNo ?? "-"
                    },
                    {
                      key: "shipment",
                      label: "物流单",
                      children: selectedDetail.shipment?.shipmentNo ?? "-"
                    }
                  ]} />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="模块定位">
                  <Space direction="vertical" size="middle">
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      {selectedDetail.moduleNarrative.role}
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {selectedDetail.moduleNarrative.boundary}
                    </Typography.Paragraph>
                    <Space wrap>
                      {renderStatusTag(selectedDetail.statusMeta)}
                      <Tag color="warning">正式版需接入真实费用单据</Tag>
                    </Space>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="多币种成本结构明细">
              <Table<CostLine>
                rowKey="key"
                size="small"
                pagination={false}
                dataSource={selectedDetail.costBreakdown}
                columns={breakdownColumns}
                scroll={{ x: 980 }}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card title="汇率口径">
                  <List
                    dataSource={selectedDetail.exchangeRates}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={0} style={{ width: "100%" }}>
                          <Typography.Text strong>{item.currency}</Typography.Text>
                          <Typography.Text type="secondary">
                            1 {item.currency} = {item.rateToCny} CNY
                          </Typography.Text>
                        </Space>
                        <Tag color={item.source === "manual" ? "success" : "processing"}>
                          {item.source === "manual" ? "数据库汇率" : "Demo 汇率"}
                        </Tag>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="财务与回款口径">
                  <Descriptions
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "paymentStatus",
                        label: "合同回款状态",
                        children: selectedDetail.contract.paymentStatus
                      },
                      {
                        key: "receivableStatus",
                        label: "应收状态",
                        children: selectedDetail.receivable?.status ?? "-"
                      },
                      {
                        key: "receivableAmount",
                        label: "应收金额",
                        children: selectedDetail.receivable
                          ? formatAmount(selectedDetail.receivable.amount, selectedDetail.receivable.currency)
                          : "-"
                      },
                      {
                        key: "receivedAmount",
                        label: "已收金额",
                        children: selectedDetail.receivable
                          ? formatAmount(selectedDetail.receivable.receivedAmount, selectedDetail.receivable.currency)
                          : "-"
                      },
                      {
                        key: "dueDate",
                        label: "账期",
                        children: formatDate(selectedDetail.receivable?.dueDate)
                      },
                      {
                        key: "paymentRecord",
                        label: "Payment 记录",
                        children: selectedDetail.payment?.id ?? "-"
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="测算时间线">
              <List
                dataSource={selectedDetail.history}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={0} style={{ width: "100%" }}>
                      <Typography.Text strong>{item.summary}</Typography.Text>
                      <Typography.Text type="secondary">
                        {item.action} · {item.operator} · {formatDateTime(item.occurredAt)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Space wrap>
              <Button icon={<DollarCircleOutlined />} onClick={() => navigate("/finance")}>
                查看财务回款
              </Button>
              <Button icon={<CarOutlined />} onClick={() => navigate("/sales")}>
                查看销售配送
              </Button>
              <Button icon={<ShoppingCartOutlined />} onClick={() => navigate("/procurement")}>
                查看采购集货
              </Button>
            </Space>
          </Space>
        ) : (
          <Card loading={isDetailLoading}>
            {!isDetailLoading ? <Empty description="请选择一条成本利润记录查看详情。" /> : null}
          </Card>
        )}
      </Drawer>
    </Space>
  );
}
