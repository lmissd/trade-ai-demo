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
import { ApartmentOutlined, ReloadOutlined } from "@ant-design/icons";
import { requestJson } from "../lib/api";

type CompanyDepartment = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
};

type CompanyUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
};

type CompanyRecord = {
  id: string;
  companyCode: string;
  name: string;
  country: string;
  countryLabel: string;
  companyType: string | null;
  companyTypeMeta: {
    code: string;
    label: string;
    color: "blue" | "gold" | "green" | "purple" | "cyan";
  };
  responsibilities: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  roleSummary: string;
  coreFunctions: string[];
  coveredModules: Array<{
    path: string;
    title: string;
  }>;
  operatingHighlights: string[];
  tagColor: "blue" | "gold" | "green" | "purple" | "cyan";
  departments: CompanyDepartment[];
  users: CompanyUser[];
  businessSnapshot: {
    contracts: number;
    purchaseOrders: number;
    shipments: number;
    customs: number;
    salesOrders: number;
    warehouses: number;
  };
  referenceRecords: {
    latestContract: {
      contractNo: string;
      customerName: string;
      amount: number;
      currency: string;
    } | null;
    latestPurchaseOrder: {
      purchaseNo: string;
      supplierName: string;
      quantity: number;
      unit: string;
      status: string;
    } | null;
    latestSalesOrder: {
      salesNo: string;
      customerName: string;
      amount: number;
      currency: string;
      status: string;
    } | null;
    warehouse: {
      name: string;
      country: string;
      status: string;
    } | null;
  };
  permissionBoundary: {
    currentDemo: string;
    futureTarget: string;
    scopeSuggestions?: string;
  };
};

type CompaniesResponse = {
  summary: {
    totalCompanies: number;
    operatingCompanies: number;
    settlementCompanies: number;
    departments: number;
    demoUsers: number;
  };
  architectureNarrative: {
    goal: string;
    currentBoundary: string;
    futureTarget: string;
  };
  records: CompanyRecord[];
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

export function CompaniesPage() {
  const screens = Grid.useBreakpoint();
  const [summary, setSummary] = useState<CompaniesResponse["summary"] | null>(null);
  const [narrative, setNarrative] = useState<CompaniesResponse["architectureNarrative"] | null>(null);
  const [records, setRecords] = useState<CompanyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CompanyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.id === selectedId) ?? null,
    [records, selectedId]
  );

  async function loadCompanies() {
    setIsLoading(true);

    try {
      const payload = await requestJson<CompaniesResponse>("/api/companies/organization");
      setSummary(payload.summary);
      setNarrative(payload.architectureNarrative);
      setRecords(payload.records);

      if (selectedId && !payload.records.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setSelectedDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载多公司主体列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCompanyDetail(companyId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<CompanyRecord>(`/api/companies/organization/${companyId}`);
      setSelectedDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载公司主体详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    setSelectedDetail(null);
    void loadCompanyDetail(selectedId);
  }, [selectedId]);

  const columns: ColumnsType<CompanyRecord> = [
    {
      title: "主体名称",
      key: "company",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Typography.Text type="secondary">{record.companyCode}</Typography.Text>
        </Space>
      )
    },
    {
      title: "国家 / 类型",
      key: "country",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.countryLabel}</Typography.Text>
          <Tag color={record.companyTypeMeta.color}>{record.companyTypeMeta.label}</Tag>
        </Space>
      )
    },
    {
      title: "职责分工",
      dataIndex: "responsibilities",
      width: 220
    },
    {
      title: "覆盖模块",
      key: "modules",
      width: 240,
      render: (_, record) => (
        <Space wrap>
          {record.coveredModules.map((item) => (
            <Tag key={item.path} color={record.tagColor}>
              {item.title}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: "部门 / 用户",
      key: "org",
      width: 160,
      render: (_, record) => `${record.departments.length} 部门 / ${record.users.length} 用户`
    },
    {
      title: "业务承接快照",
      key: "snapshot",
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Tag>合同 {record.businessSnapshot.contracts}</Tag>
          <Tag>采购 {record.businessSnapshot.purchaseOrders}</Tag>
          <Tag>物流 {record.businessSnapshot.shipments}</Tag>
          <Tag>清关 {record.businessSnapshot.customs}</Tag>
          <Tag>销售 {record.businessSnapshot.salesOrders}</Tag>
          <Tag>仓库 {record.businessSnapshot.warehouses}</Tag>
        </Space>
      )
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Button type="link" onClick={() => setSelectedId(record.id)}>
          查看主体
        </Button>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="正式版会按公司、国家、岗位进行权限隔离。"
        description="当前 Demo 版只展示组织结构和职责分工，不做真实权限隔离，也不做复杂授权审批。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="主体数量" value={summary?.totalCompanies ?? 0} suffix="家" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="经营主体" value={summary?.operatingCompanies ?? 0} suffix="家" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="结算主体" value={summary?.settlementCompanies ?? 0} suffix="家" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="部门总数" value={summary?.departments ?? 0} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space direction="vertical" size="middle">
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            多公司架构说明
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {narrative?.goal ??
              "通过多主体组织结构展示，让甲方看到系统不仅能做库存扫码，也能承接国际贸易集团化运营形态。"}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {narrative?.currentBoundary}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {narrative?.futureTarget}
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card
        title="多公司主体列表"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadCompanies()}>
            刷新主体
          </Button>
        }
      >
        {records.length > 0 ? (
          <Table<CompanyRecord>
            rowKey="id"
            loading={isLoading}
            dataSource={records}
            columns={columns}
            pagination={false}
            scroll={{ x: 1460 }}
          />
        ) : (
          <Empty description="当前还没有公司主体数据。" />
        )}
      </Card>

      <Drawer
        title={selectedRecord ? `主体详情 · ${selectedRecord.name}` : "主体详情"}
        placement="right"
        width={screens.xs ? "100%" : 820}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      >
        {selectedDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card>
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: "name",
                    label: "主体名称",
                    children: selectedDetail.name
                  },
                  {
                    key: "code",
                    label: "主体编码",
                    children: selectedDetail.companyCode
                  },
                  {
                    key: "country",
                    label: "所在国家 / 地区",
                    children: selectedDetail.countryLabel
                  },
                  {
                    key: "type",
                    label: "主体类型",
                    children: <Tag color={selectedDetail.companyTypeMeta.color}>{selectedDetail.companyTypeMeta.label}</Tag>
                  },
                  {
                    key: "responsibilities",
                    label: "职责分工",
                    children: selectedDetail.responsibilities
                  },
                  {
                    key: "createdAt",
                    label: "建立时间",
                    children: formatDate(selectedDetail.createdAt)
                  }
                ]}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card title="角色定位">
                  <Space direction="vertical" size="middle">
                    <Typography.Paragraph style={{ marginBottom: 0 }}>{selectedDetail.roleSummary}</Typography.Paragraph>
                    <Space wrap>
                      {selectedDetail.coreFunctions.map((item) => (
                        <Tag key={item} color={selectedDetail.tagColor}>
                          {item}
                        </Tag>
                      ))}
                    </Space>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="正式版权限边界">
                  <Space direction="vertical" size="middle">
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      {selectedDetail.permissionBoundary.currentDemo}
                    </Typography.Paragraph>
                    <Typography.Paragraph strong style={{ marginBottom: 0 }}>
                      {selectedDetail.permissionBoundary.futureTarget}
                    </Typography.Paragraph>
                    {selectedDetail.permissionBoundary.scopeSuggestions ? (
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {selectedDetail.permissionBoundary.scopeSuggestions}
                      </Typography.Paragraph>
                    ) : null}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="部门与账号">
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Typography.Title level={5}>部门</Typography.Title>
                  <List
                    dataSource={selectedDetail.departments}
                    locale={{ emptyText: "当前主体暂无部门记录。" }}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={0}>
                          <Typography.Text strong>{item.name}</Typography.Text>
                          <Typography.Text type="secondary">
                            {item.code} / {item.type}
                          </Typography.Text>
                        </Space>
                        <Tag>{item.status}</Tag>
                      </List.Item>
                    )}
                  />
                </Col>
                <Col xs={24} xl={12}>
                  <Typography.Title level={5}>账号</Typography.Title>
                  <List
                    dataSource={selectedDetail.users}
                    locale={{ emptyText: "当前主体暂无演示账号。" }}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" size={0}>
                          <Typography.Text strong>{item.displayName}</Typography.Text>
                          <Typography.Text type="secondary">
                            {item.username} / {item.role}
                          </Typography.Text>
                        </Space>
                        <Tag color="processing">{item.status}</Tag>
                      </List.Item>
                    )}
                  />
                </Col>
              </Row>
            </Card>

            <Card title="承接模块与业务快照">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Space wrap>
                  {selectedDetail.coveredModules.map((item) => (
                    <Tag key={item.path} color={selectedDetail.tagColor}>
                      {item.title}
                    </Tag>
                  ))}
                </Space>
                <Space wrap>
                  <Tag>合同 {selectedDetail.businessSnapshot.contracts}</Tag>
                  <Tag>采购 {selectedDetail.businessSnapshot.purchaseOrders}</Tag>
                  <Tag>物流 {selectedDetail.businessSnapshot.shipments}</Tag>
                  <Tag>清关 {selectedDetail.businessSnapshot.customs}</Tag>
                  <Tag>销售 {selectedDetail.businessSnapshot.salesOrders}</Tag>
                  <Tag>仓库 {selectedDetail.businessSnapshot.warehouses}</Tag>
                </Space>
                <List
                  dataSource={selectedDetail.operatingHighlights}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              </Space>
            </Card>

            <Card title="当前参考业务记录">
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: "contract",
                    label: "最新合同",
                    children: selectedDetail.referenceRecords.latestContract
                      ? `${selectedDetail.referenceRecords.latestContract.contractNo} / ${selectedDetail.referenceRecords.latestContract.customerName} / ${formatAmount(selectedDetail.referenceRecords.latestContract.amount, selectedDetail.referenceRecords.latestContract.currency)}`
                      : "-"
                  },
                  {
                    key: "purchase",
                    label: "最新采购单",
                    children: selectedDetail.referenceRecords.latestPurchaseOrder
                      ? `${selectedDetail.referenceRecords.latestPurchaseOrder.purchaseNo} / ${selectedDetail.referenceRecords.latestPurchaseOrder.supplierName} / ${selectedDetail.referenceRecords.latestPurchaseOrder.quantity}${selectedDetail.referenceRecords.latestPurchaseOrder.unit}`
                      : "-"
                  },
                  {
                    key: "sales",
                    label: "最新销售单",
                    children: selectedDetail.referenceRecords.latestSalesOrder
                      ? `${selectedDetail.referenceRecords.latestSalesOrder.salesNo} / ${selectedDetail.referenceRecords.latestSalesOrder.customerName} / ${formatAmount(selectedDetail.referenceRecords.latestSalesOrder.amount, selectedDetail.referenceRecords.latestSalesOrder.currency)}`
                      : "-"
                  },
                  {
                    key: "warehouse",
                    label: "关联仓库",
                    children: selectedDetail.referenceRecords.warehouse
                      ? `${selectedDetail.referenceRecords.warehouse.name} / ${selectedDetail.referenceRecords.warehouse.country}`
                      : "-"
                  }
                ]}
              />
            </Card>
          </Space>
        ) : (
          <Card loading={isDetailLoading}>
            {!isDetailLoading ? <Empty description="请选择一个主体查看详情。" /> : null}
          </Card>
        )}
      </Drawer>
    </Space>
  );
}
