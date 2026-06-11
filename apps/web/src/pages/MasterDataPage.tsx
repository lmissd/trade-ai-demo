import {
  ApartmentOutlined,
  DatabaseOutlined,
  IdcardOutlined,
  ReloadOutlined,
  ShopOutlined,
  TeamOutlined,
  TruckOutlined
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";

type StatusMeta = {
  label: string;
  color: "success" | "processing" | "warning" | "error" | "default";
};

type MasterDataDomain = "skus" | "customers" | "suppliers" | "users" | "vehicles" | "drivers";

type SkuRecord = {
  id: string;
  skuCode: string;
  name: string;
  spec: string | null;
  modelNo: string | null;
  material: string | null;
  unit: string;
  category: string | null;
  purchaseReferencePrice: number | null;
  salesReferencePrice: number | null;
  referenceCurrency: string;
  status: string;
  statusMeta: StatusMeta;
  referencePriceLabel: string;
  createdAt: string;
  updatedAt: string;
};

type PartyRecord = {
  id: string;
  customerCode?: string;
  supplierCode?: string;
  name: string;
  country: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNo: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAddress: string | null;
  cooperationCompanyId: string | null;
  cooperationCompanyName: string | null;
  customerType?: string;
  supplierType?: string;
  contactSummary: string;
  status: string;
  statusMeta: StatusMeta;
  createdAt: string;
  updatedAt: string;
};

type UserRecord = {
  id: string;
  username: string;
  employeeNo: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  status: string;
  statusMeta: StatusMeta;
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  workCountry: string | null;
  responsibilityScope: string | null;
  contactSummary: string;
  createdAt: string;
  updatedAt: string;
};

type VehicleRecord = {
  id: string;
  vehicleCode: string | null;
  vehicleQrCode: string | null;
  plateNo: string;
  companyId: string | null;
  companyName: string | null;
  ownershipCompanyId: string | null;
  ownershipCompanyName: string | null;
  vehicleType: string | null;
  driverId: string | null;
  driverCode: string | null;
  driverName: string | null;
  driverPhone: string | null;
  maintenanceNote: string | null;
  status: string;
  statusMeta: StatusMeta;
  createdAt: string;
  updatedAt: string;
};

type DriverRecord = {
  id: string;
  driverCode: string | null;
  employeeNo: string | null;
  name: string;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  licenseNo: string | null;
  workCountry: string | null;
  rewardPenaltyNotes: string | null;
  boundVehicleId: string | null;
  boundVehicleCode: string | null;
  boundPlateNo: string | null;
  status: string;
  statusMeta: StatusMeta;
  createdAt: string;
  updatedAt: string;
};

type CompanyRecord = {
  id: string;
  companyCode: string;
  name: string;
  country: string;
  companyType: string | null;
  status: string;
  statusMeta: StatusMeta;
};

type DepartmentRecord = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  departmentCode: string;
  name: string;
  type: string | null;
  status: string;
  statusMeta: StatusMeta;
};

type MasterDataResponse = {
  generatedAt: string;
  summary: {
    skus: number;
    activeSkus: number;
    customers: number;
    suppliers: number;
    users: number;
    drivers: number;
    vehicles: number;
    boundVehicles: number;
    companies: number;
    departments: number;
  };
  narrative: {
    role: string;
    boundary: string;
    next: string;
  };
  records: {
    skus: SkuRecord[];
    customers: PartyRecord[];
    suppliers: PartyRecord[];
    users: UserRecord[];
    vehicles: VehicleRecord[];
    drivers: DriverRecord[];
    companies: CompanyRecord[];
    departments: DepartmentRecord[];
  };
};

type SelectedRecord =
  | { domain: "skus"; record: SkuRecord; title: string }
  | { domain: "customers"; record: PartyRecord; title: string }
  | { domain: "suppliers"; record: PartyRecord; title: string }
  | { domain: "users"; record: UserRecord; title: string }
  | { domain: "vehicles"; record: VehicleRecord; title: string }
  | { domain: "drivers"; record: DriverRecord; title: string };

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

function fallback(value?: string | number | null) {
  if (typeof value === "number") {
    return value.toLocaleString("zh-CN");
  }

  return value && value.trim().length > 0 ? value : "-";
}

function statusTag(statusMeta: StatusMeta) {
  return <Tag color={statusMeta.color}>{statusMeta.label}</Tag>;
}

function nextStatusLabel(status: string) {
  return status === "ACTIVE" ? "停用" : "启用";
}

function nextStatusValue(status: string) {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}

function buildDetailItems(selected: SelectedRecord | null) {
  if (!selected) {
    return [];
  }

  const { domain, record } = selected;

  if (domain === "skus") {
    return [
      { key: "skuCode", label: "SKU 编码", children: record.skuCode },
      { key: "name", label: "商品名称", children: record.name },
      { key: "spec", label: "规格", children: fallback(record.spec) },
      { key: "modelNo", label: "型号", children: fallback(record.modelNo) },
      { key: "material", label: "材质", children: fallback(record.material) },
      { key: "unit", label: "单位", children: record.unit },
      { key: "category", label: "分类", children: fallback(record.category) },
      {
        key: "purchaseReferencePrice",
        label: "采购参考价",
        children: formatAmount(record.purchaseReferencePrice, record.referenceCurrency)
      },
      {
        key: "salesReferencePrice",
        label: "销售参考价",
        children: formatAmount(record.salesReferencePrice, record.referenceCurrency)
      },
      { key: "status", label: "启停状态", children: statusTag(record.statusMeta) },
      { key: "updatedAt", label: "更新时间", children: formatDateTime(record.updatedAt) }
    ];
  }

  if (domain === "customers" || domain === "suppliers") {
    const code = domain === "customers" ? record.customerCode : record.supplierCode;
    const type = domain === "customers" ? record.customerType : record.supplierType;

    return [
      { key: "code", label: "统一编码", children: fallback(code) },
      { key: "name", label: domain === "customers" ? "客户名称" : "供应商名称", children: record.name },
      { key: "type", label: "客商类型", children: fallback(type) },
      { key: "country", label: "国家", children: record.country },
      { key: "contactName", label: "联系人", children: fallback(record.contactName) },
      { key: "phone", label: "电话", children: fallback(record.phone) },
      { key: "email", label: "邮箱", children: fallback(record.email) },
      { key: "address", label: "开户地址", children: fallback(record.address) },
      { key: "taxNo", label: "税号", children: fallback(record.taxNo) },
      { key: "bankName", label: "开户银行", children: fallback(record.bankName) },
      { key: "bankAccountNo", label: "银行账号", children: fallback(record.bankAccountNo) },
      { key: "bankAddress", label: "银行地址", children: fallback(record.bankAddress) },
      { key: "cooperationCompanyName", label: "合作主体", children: fallback(record.cooperationCompanyName) },
      { key: "status", label: "启停状态", children: statusTag(record.statusMeta) },
      { key: "updatedAt", label: "更新时间", children: formatDateTime(record.updatedAt) }
    ];
  }

  if (domain === "users") {
    return [
      { key: "employeeNo", label: "工号", children: fallback(record.employeeNo) },
      { key: "username", label: "登录名", children: record.username },
      { key: "displayName", label: "姓名", children: record.displayName },
      { key: "role", label: "系统角色", children: record.role },
      { key: "position", label: "岗位", children: fallback(record.position) },
      { key: "companyName", label: "所属公司", children: fallback(record.companyName) },
      { key: "departmentName", label: "部门", children: fallback(record.departmentName) },
      { key: "workCountry", label: "工作国家", children: fallback(record.workCountry) },
      { key: "phone", label: "联系方式", children: record.contactSummary },
      { key: "responsibilityScope", label: "责任追溯", children: fallback(record.responsibilityScope) },
      { key: "status", label: "启停状态", children: statusTag(record.statusMeta) },
      { key: "updatedAt", label: "更新时间", children: formatDateTime(record.updatedAt) }
    ];
  }

  if (domain === "vehicles") {
    return [
      { key: "vehicleCode", label: "车辆编码", children: fallback(record.vehicleCode) },
      { key: "vehicleQrCode", label: "车辆二维码", children: fallback(record.vehicleQrCode) },
      { key: "plateNo", label: "车牌号", children: record.plateNo },
      { key: "vehicleType", label: "车辆类型", children: fallback(record.vehicleType) },
      { key: "companyName", label: "所属公司", children: fallback(record.companyName) },
      { key: "ownershipCompanyName", label: "产权主体", children: fallback(record.ownershipCompanyName) },
      { key: "driverName", label: "绑定司机", children: fallback(record.driverName) },
      { key: "driverCode", label: "司机编码", children: fallback(record.driverCode) },
      { key: "driverPhone", label: "司机电话", children: fallback(record.driverPhone) },
      { key: "maintenanceNote", label: "车辆备注", children: fallback(record.maintenanceNote) },
      { key: "status", label: "车辆状态", children: statusTag(record.statusMeta) },
      { key: "updatedAt", label: "更新时间", children: formatDateTime(record.updatedAt) }
    ];
  }

  return [
    { key: "driverCode", label: "司机编码", children: fallback(record.driverCode) },
    { key: "employeeNo", label: "司机工号", children: fallback(record.employeeNo) },
    { key: "name", label: "司机姓名", children: record.name },
    { key: "phone", label: "联系电话", children: fallback(record.phone) },
    { key: "licenseNo", label: "驾驶证号", children: fallback(record.licenseNo) },
    { key: "companyName", label: "所属公司", children: fallback(record.companyName) },
    { key: "workCountry", label: "工作国家", children: fallback(record.workCountry) },
    { key: "boundVehicleCode", label: "绑定车辆编码", children: fallback(record.boundVehicleCode) },
    { key: "boundPlateNo", label: "绑定车牌", children: fallback(record.boundPlateNo) },
    { key: "rewardPenaltyNotes", label: "奖惩记录", children: fallback(record.rewardPenaltyNotes) },
    { key: "status", label: "司机状态", children: statusTag(record.statusMeta) },
    { key: "updatedAt", label: "更新时间", children: formatDateTime(record.updatedAt) }
  ];
}

export function MasterDataPage() {
  const [payload, setPayload] = useState<MasterDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  async function loadMasterData() {
    setIsLoading(true);

    try {
      const nextPayload = await requestJson<MasterDataResponse>("/api/master-data/overview");
      setPayload(nextPayload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载基础主数据失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateStatus(domain: MasterDataDomain, recordId: string, status: string) {
    const actionKey = `${domain}-${recordId}-${status}`;
    setUpdatingKey(actionKey);

    try {
      await requestJson(`/api/master-data/${domain}/${recordId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      message.success("主数据状态已更新，并已写入审计日志。");
      await loadMasterData();
      setSelected(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新主数据状态失败。");
    } finally {
      setUpdatingKey(null);
    }
  }

  useEffect(() => {
    void loadMasterData();
  }, []);

  const skuColumns: ColumnsType<SkuRecord> = [
    {
      title: "SKU 编码",
      dataIndex: "skuCode",
      fixed: "left",
      width: 150
    },
    {
      title: "商品名称",
      dataIndex: "name",
      width: 180
    },
    {
      title: "规格 / 型号",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{fallback(record.spec)}</Typography.Text>
          <Typography.Text type="secondary">{fallback(record.modelNo)}</Typography.Text>
        </Space>
      )
    },
    {
      title: "材质 / 分类",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{fallback(record.material)}</Typography.Text>
          <Typography.Text type="secondary">{fallback(record.category)}</Typography.Text>
        </Space>
      )
    },
    {
      title: "单位",
      dataIndex: "unit",
      width: 90
    },
    {
      title: "参考价",
      dataIndex: "referencePriceLabel",
      width: 210
    },
    {
      title: "状态",
      width: 110,
      render: (_, record) => statusTag(record.statusMeta)
    },
    {
      title: "操作",
      width: 170,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setSelected({ domain: "skus", record, title: record.skuCode })}>
            查看
          </Button>
          <Button
            type="link"
            loading={updatingKey === `skus-${record.id}-${nextStatusValue(record.status)}`}
            onClick={() => void updateStatus("skus", record.id, nextStatusValue(record.status))}
          >
            {nextStatusLabel(record.status)}
          </Button>
        </Space>
      )
    }
  ];

  const partyColumns = (domain: "customers" | "suppliers"): ColumnsType<PartyRecord> => [
    {
      title: "统一编码",
      width: 160,
      render: (_, record) => fallback(domain === "customers" ? record.customerCode : record.supplierCode)
    },
    {
      title: domain === "customers" ? "客户名称" : "供应商名称",
      dataIndex: "name",
      width: 220
    },
    {
      title: "国家",
      dataIndex: "country",
      width: 140
    },
    {
      title: "联系人",
      dataIndex: "contactSummary",
      width: 240
    },
    {
      title: "税号",
      dataIndex: "taxNo",
      width: 160,
      render: fallback
    },
    {
      title: "合作主体",
      dataIndex: "cooperationCompanyName",
      width: 160,
      render: fallback
    },
    {
      title: "状态",
      width: 110,
      render: (_, record) => statusTag(record.statusMeta)
    },
    {
      title: "操作",
      width: 170,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            onClick={() =>
              setSelected({
                domain,
                record,
                title: fallback(domain === "customers" ? record.customerCode : record.supplierCode)
              })
            }
          >
            查看
          </Button>
          <Button
            type="link"
            loading={updatingKey === `${domain}-${record.id}-${nextStatusValue(record.status)}`}
            onClick={() => void updateStatus(domain, record.id, nextStatusValue(record.status))}
          >
            {nextStatusLabel(record.status)}
          </Button>
        </Space>
      )
    }
  ];

  const userColumns: ColumnsType<UserRecord> = [
    { title: "工号", dataIndex: "employeeNo", width: 150, render: fallback },
    { title: "姓名", dataIndex: "displayName", width: 140 },
    { title: "岗位", dataIndex: "position", width: 150, render: fallback },
    { title: "部门", dataIndex: "departmentName", width: 150, render: fallback },
    { title: "所属公司", dataIndex: "companyName", width: 160, render: fallback },
    { title: "工作国家", dataIndex: "workCountry", width: 160, render: fallback },
    { title: "联系方式", dataIndex: "contactSummary", width: 230 },
    { title: "状态", width: 110, render: (_, record) => statusTag(record.statusMeta) },
    {
      title: "操作",
      width: 170,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setSelected({ domain: "users", record, title: record.displayName })}>
            查看
          </Button>
          <Button
            type="link"
            loading={updatingKey === `users-${record.id}-${nextStatusValue(record.status)}`}
            onClick={() => void updateStatus("users", record.id, nextStatusValue(record.status))}
          >
            {nextStatusLabel(record.status)}
          </Button>
        </Space>
      )
    }
  ];

  const vehicleColumns: ColumnsType<VehicleRecord> = [
    { title: "车辆编码", dataIndex: "vehicleCode", width: 150, render: fallback },
    { title: "车辆二维码", dataIndex: "vehicleQrCode", width: 150, render: fallback },
    { title: "车牌号", dataIndex: "plateNo", width: 130 },
    { title: "车辆类型", dataIndex: "vehicleType", width: 130, render: fallback },
    { title: "所属公司", dataIndex: "companyName", width: 160, render: fallback },
    { title: "绑定司机", dataIndex: "driverName", width: 160, render: fallback },
    { title: "状态", width: 110, render: (_, record) => statusTag(record.statusMeta) },
    {
      title: "操作",
      width: 260,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setSelected({ domain: "vehicles", record, title: record.plateNo })}>
            查看
          </Button>
          <Button
            type="link"
            loading={updatingKey === `vehicles-${record.id}-${nextStatusValue(record.status)}`}
            onClick={() => void updateStatus("vehicles", record.id, nextStatusValue(record.status))}
          >
            {nextStatusLabel(record.status)}
          </Button>
          {record.status !== "MAINTENANCE" ? (
            <Button
              type="link"
              loading={updatingKey === `vehicles-${record.id}-MAINTENANCE`}
              onClick={() => void updateStatus("vehicles", record.id, "MAINTENANCE")}
            >
              设为维护
            </Button>
          ) : null}
        </Space>
      )
    }
  ];

  const driverColumns: ColumnsType<DriverRecord> = [
    { title: "司机编码", dataIndex: "driverCode", width: 150, render: fallback },
    { title: "司机工号", dataIndex: "employeeNo", width: 150, render: fallback },
    { title: "姓名", dataIndex: "name", width: 150 },
    { title: "驾驶证号", dataIndex: "licenseNo", width: 170, render: fallback },
    { title: "所属公司", dataIndex: "companyName", width: 170, render: fallback },
    { title: "绑定车辆", dataIndex: "boundPlateNo", width: 150, render: fallback },
    { title: "状态", width: 110, render: (_, record) => statusTag(record.statusMeta) },
    {
      title: "操作",
      width: 170,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setSelected({ domain: "drivers", record, title: record.name })}>
            查看
          </Button>
          <Button
            type="link"
            loading={updatingKey === `drivers-${record.id}-${nextStatusValue(record.status)}`}
            onClick={() => void updateStatus("drivers", record.id, nextStatusValue(record.status))}
          >
            {nextStatusLabel(record.status)}
          </Button>
        </Space>
      )
    }
  ];

  const tabItems = payload
    ? [
        {
          key: "skus",
          label: "SKU 主数据",
          children: (
            <Table
              rowKey="id"
              columns={skuColumns}
              dataSource={payload.records.skus}
              loading={isLoading}
              scroll={{ x: 1250 }}
              pagination={{ pageSize: 8 }}
            />
          )
        },
        {
          key: "customers",
          label: "客户主数据",
          children: (
            <Table
              rowKey="id"
              columns={partyColumns("customers")}
              dataSource={payload.records.customers}
              loading={isLoading}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 8 }}
            />
          )
        },
        {
          key: "suppliers",
          label: "供应商主数据",
          children: (
            <Table
              rowKey="id"
              columns={partyColumns("suppliers")}
              dataSource={payload.records.suppliers}
              loading={isLoading}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 8 }}
            />
          )
        },
        {
          key: "users",
          label: "人员主数据",
          children: (
            <Table
              rowKey="id"
              columns={userColumns}
              dataSource={payload.records.users}
              loading={isLoading}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 8 }}
            />
          )
        },
        {
          key: "vehicles",
          label: "车辆主数据",
          children: (
            <Table
              rowKey="id"
              columns={vehicleColumns}
              dataSource={payload.records.vehicles}
              loading={isLoading}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 8 }}
            />
          )
        },
        {
          key: "drivers",
          label: "司机主数据",
          children: (
            <Table
              rowKey="id"
              columns={driverColumns}
              dataSource={payload.records.drivers}
              loading={isLoading}
              scroll={{ x: 1200 }}
              pagination={{ pageSize: 8 }}
            />
          )
        }
      ]
    : [];

  return (
    <div className="document-workspace master-data-workspace">
      <section className="page-hero master-data-hero">
        <div>
          <Typography.Title level={2}>基础主数据</Typography.Title>
          <Typography.Paragraph>
            Demo 2.0 从这里开始把系统底座做厚：SKU、客商、人员、车辆和司机都使用统一编码、启停状态和责任追溯，后续合同、采购、仓储、销售、财务都会逐步引用这些主数据。
          </Typography.Paragraph>
          <Space wrap>
            <Tag color="success">统一编码</Tag>
            <Tag color="processing">跨模块复用</Tag>
            <Tag color="warning">第一版先做台账与启停</Tag>
          </Space>
        </div>
        <Card className="placeholder-card master-data-hero-card" bordered={false}>
          {payload ? (
            <div className="master-data-hero-grid">
              <div>
                <span className="app-header-panel-label">数据更新时间</span>
                <strong>{formatDateTime(payload.generatedAt)}</strong>
              </div>
              <div>
                <span className="app-header-panel-label">主数据总量</span>
                <strong>
                  {payload.summary.skus +
                    payload.summary.customers +
                    payload.summary.suppliers +
                    payload.summary.users +
                    payload.summary.vehicles +
                    payload.summary.drivers}
                </strong>
              </div>
              <div>
                <span className="app-header-panel-label">公司 / 部门</span>
                <strong>
                  {payload.summary.companies} / {payload.summary.departments}
                </strong>
              </div>
              <div>
                <span className="app-header-panel-label">车司绑定</span>
                <strong>
                  {payload.summary.boundVehicles} / {payload.summary.vehicles}
                </strong>
              </div>
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无主数据总览" />
          )}
        </Card>
      </section>

      <Alert
        showIcon
        type="info"
        message="阶段 21 的边界"
        description={
          payload
            ? `${payload.narrative.role} ${payload.narrative.boundary}`
            : "当前第一版先做统一台账、字段补齐、状态启停和责任追溯展示，不做复杂审批和完整主数据治理流程。"
        }
        action={
          <Button icon={<ReloadOutlined />} onClick={() => void loadMasterData()}>
            刷新主数据
          </Button>
        }
      />

      <div className="master-data-stat-grid">
        <Card className="stat-card" bordered={false}>
          <Statistic title="SKU 主数据" value={payload?.summary.skus ?? 0} prefix={<DatabaseOutlined />} />
          <Typography.Text type="secondary">启用 {payload?.summary.activeSkus ?? 0} 个</Typography.Text>
        </Card>
        <Card className="stat-card" bordered={false}>
          <Statistic
            title="客户 / 供应商"
            value={`${payload?.summary.customers ?? 0} / ${payload?.summary.suppliers ?? 0}`}
            prefix={<ShopOutlined />}
          />
          <Typography.Text type="secondary">统一编码、税号、开户地址、合作主体</Typography.Text>
        </Card>
        <Card className="stat-card" bordered={false}>
          <Statistic title="人员主数据" value={payload?.summary.users ?? 0} prefix={<TeamOutlined />} />
          <Typography.Text type="secondary">工号、岗位、部门、国家、责任追溯</Typography.Text>
        </Card>
        <Card className="stat-card" bordered={false}>
          <Statistic
            title="车辆 / 司机"
            value={`${payload?.summary.vehicles ?? 0} / ${payload?.summary.drivers ?? 0}`}
            prefix={<TruckOutlined />}
          />
          <Typography.Text type="secondary">一车一码、一车绑司机、车辆状态</Typography.Text>
        </Card>
      </div>

      <Card className="placeholder-card master-data-card" bordered={false}>
        {payload ? (
          <Tabs items={tabItems} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无基础主数据，请先运行 seed 或恢复演示环境。" />
        )}
      </Card>

      <Card className="placeholder-card master-data-card" title="组织底座参考" bordered={false}>
        {payload ? (
          <div className="master-data-org-grid">
            <div>
              <Typography.Title level={5}>
                <ApartmentOutlined /> 公司主体
              </Typography.Title>
              <Space wrap>
                {payload.records.companies.map((item) => (
                  <Tag key={item.id} color={item.statusMeta.color}>
                    {item.companyCode} / {item.name}
                  </Tag>
                ))}
              </Space>
            </div>
            <div>
              <Typography.Title level={5}>
                <IdcardOutlined /> 部门
              </Typography.Title>
              <Space wrap>
                {payload.records.departments.map((item) => (
                  <Tag key={item.id}>
                    {item.departmentCode} / {item.name}
                  </Tag>
                ))}
              </Space>
            </div>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无组织底座数据" />
        )}
      </Card>

      <Drawer
        width={760}
        title={selected?.title ?? "主数据详情"}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        extra={
          selected ? (
            <Space>
              <Button
                loading={
                  updatingKey ===
                  `${selected.domain}-${selected.record.id}-${nextStatusValue(selected.record.status)}`
                }
                onClick={() =>
                  void updateStatus(
                    selected.domain,
                    selected.record.id,
                    nextStatusValue(selected.record.status)
                  )
                }
              >
                {nextStatusLabel(selected.record.status)}
              </Button>
              {selected.domain === "vehicles" && selected.record.status !== "MAINTENANCE" ? (
                <Button
                  loading={updatingKey === `${selected.domain}-${selected.record.id}-MAINTENANCE`}
                  onClick={() => void updateStatus(selected.domain, selected.record.id, "MAINTENANCE")}
                >
                  设为维护
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        <Descriptions column={1} bordered items={buildDetailItems(selected)} />
      </Drawer>
    </div>
  );
}
