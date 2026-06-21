import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, List, Row, Space, Statistic, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

export type InventorySummaryResponse = {
  generatedAt: string;
  filters: {
    batchId: string | null;
    contractId: string | null;
    warehouseId: string | null;
  };
  summary: {
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    abnormalQuantity: number;
    totalInboundMovements: number;
    totalOutboundMovements: number;
    statusAccountedQuantity: number;
    isConsistent: boolean;
  };
  hierarchySummary: {
    unitCount: number;
    boxCount: number;
    palletCount: number;
  };
  ageBuckets: Array<{
    key: string;
    label: string;
    quantity: number;
  }>;
  locationUtilization: Array<{
    locationId: string;
    warehouseId: string | null;
    locationCode: string;
    zone: string | null;
    capacity: number | null;
    occupiedQuantity: number;
    frozenQuantity: number;
    availableCapacity: number | null;
    utilizationPercent: number | null;
  }>;
  freezeReasons: Array<{
    reason: string;
    quantity: number;
  }>;
  stocktakes: Array<{
    id: string;
    stocktakeNo: string;
    status: string;
    batchId: string | null;
    batchNo: string;
    warehouseId: string | null;
    warehouseName: string;
    plannedQuantity: number;
    actualQuantity: number;
    differenceQuantity: number;
    operatorName: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  byBatch: Array<{
    batchId: string;
    batchNo: string;
    batchStatus: string;
    contractId: string | null;
    contractNo: string;
    productName: string;
    batchQuantity: number;
    unit: string;
    warehouseId: string | null;
    warehouseName: string;
    latestStatusChangedAt: string;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    abnormalQuantity: number;
  }>;
  byContract: Array<{
    contractId: string | null;
    contractNo: string;
    customerName: string;
    supplierName: string;
    contractQuantity: number | null;
    unit: string | null;
    batchCount: number;
    warehouseCount: number;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    abnormalQuantity: number;
  }>;
  byWarehouse: Array<{
    warehouseId: string | null;
    warehouseName: string;
    contractCount: number;
    batchCount: number;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    abnormalQuantity: number;
  }>;
  recentMovements: Array<{
    id: string;
    movementType: string;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    operatorName: string | null;
    occurredAt: string;
    qrCode: string;
    productName: string | null;
    batchNo: string;
    contractNo: string;
  }>;
};

type WarehouseInventorySectionProps = {
  data: InventorySummaryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  currentBatchId?: string | null;
  currentContractId?: string | null;
  currentWarehouseId?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function renderCurrentTag(isCurrent: boolean) {
  return isCurrent ? <Tag color="gold">当前任务</Tag> : null;
}

export function WarehouseInventorySection({
  data,
  loading,
  onRefresh,
  currentBatchId,
  currentContractId,
  currentWarehouseId
}: WarehouseInventorySectionProps) {
  const batchColumns: ColumnsType<InventorySummaryResponse["byBatch"][number]> = [
    {
      title: "批次号",
      dataIndex: "batchNo",
      width: 220,
      render: (value: string, record) => (
        <Space size={[8, 8]} wrap>
          <span>{value}</span>
          {renderCurrentTag(record.batchId === currentBatchId)}
        </Space>
      )
    },
    {
      title: "关联合同",
      dataIndex: "contractNo",
      width: 180
    },
    {
      title: "商品",
      dataIndex: "productName",
      width: 180
    },
    {
      title: "批次数量",
      key: "batchQuantity",
      width: 130,
      render: (_, record) => `${record.batchQuantity}${record.unit}`
    },
    {
      title: "仓库",
      dataIndex: "warehouseName",
      width: 160
    },
    {
      title: "在途",
      dataIndex: "inTransitInventory",
      width: 90
    },
    {
      title: "实时",
      dataIndex: "realtimeInventory",
      width: 90
    },
    {
      title: "可用",
      dataIndex: "availableInventory",
      width: 90
    },
    {
      title: "冻结",
      dataIndex: "frozenInventory",
      width: 90
    },
    {
      title: "已出库",
      dataIndex: "outboundQuantity",
      width: 100
    },
    {
      title: "最近变化",
      dataIndex: "latestStatusChangedAt",
      width: 180,
      render: (value: string) => formatDateTime(value)
    }
  ];

  const contractColumns: ColumnsType<InventorySummaryResponse["byContract"][number]> = [
    {
      title: "合同号",
      dataIndex: "contractNo",
      width: 220,
      render: (value: string, record) => (
        <Space size={[8, 8]} wrap>
          <span>{value}</span>
          {renderCurrentTag(record.contractId === currentContractId)}
        </Space>
      )
    },
    {
      title: "客户 / 供应商",
      key: "businessPartners",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.customerName}</div>
          <div className="documents-secondary-text">{record.supplierName}</div>
        </div>
      )
    },
    {
      title: "合同数量",
      key: "contractQuantity",
      width: 130,
      render: (_, record) =>
        record.contractQuantity !== null ? `${record.contractQuantity}${record.unit ?? ""}` : "-"
    },
    {
      title: "批次数",
      dataIndex: "batchCount",
      width: 90
    },
    {
      title: "在途",
      dataIndex: "inTransitInventory",
      width: 90
    },
    {
      title: "实时",
      dataIndex: "realtimeInventory",
      width: 90
    },
    {
      title: "可用",
      dataIndex: "availableInventory",
      width: 90
    },
    {
      title: "冻结",
      dataIndex: "frozenInventory",
      width: 90
    },
    {
      title: "已出库",
      dataIndex: "outboundQuantity",
      width: 100
    }
  ];

  const warehouseColumns: ColumnsType<InventorySummaryResponse["byWarehouse"][number]> = [
    {
      title: "仓库",
      dataIndex: "warehouseName",
      width: 220,
      render: (value: string, record) => (
        <Space size={[8, 8]} wrap>
          <span>{value}</span>
          {renderCurrentTag(record.warehouseId === currentWarehouseId)}
        </Space>
      )
    },
    {
      title: "合同数",
      dataIndex: "contractCount",
      width: 100
    },
    {
      title: "批次数",
      dataIndex: "batchCount",
      width: 100
    },
    {
      title: "在途",
      dataIndex: "inTransitInventory",
      width: 90
    },
    {
      title: "实时",
      dataIndex: "realtimeInventory",
      width: 90
    },
    {
      title: "可用",
      dataIndex: "availableInventory",
      width: 90
    },
    {
      title: "冻结",
      dataIndex: "frozenInventory",
      width: 90
    },
    {
      title: "已出库",
      dataIndex: "outboundQuantity",
      width: 100
    },
    {
      title: "异常",
      dataIndex: "abnormalQuantity",
      width: 90
    }
  ];

  const movementColumns: ColumnsType<InventorySummaryResponse["recentMovements"][number]> = [
    {
      title: "操作时间",
      dataIndex: "occurredAt",
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: "动作",
      dataIndex: "movementType",
      width: 110,
      render: (value: string) => <Tag color={value === "INBOUND" ? "processing" : "volcano"}>{value}</Tag>
    },
    {
      title: "二维码",
      dataIndex: "qrCode",
      width: 200
    },
    {
      title: "批次 / 合同",
      key: "businessNo",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.batchNo}</div>
          <div className="documents-secondary-text">{record.contractNo}</div>
        </div>
      )
    },
    {
      title: "状态变化",
      key: "statusChange",
      width: 180,
      render: (_, record) => `${record.fromStatus ?? "-"} -> ${record.toStatus ?? "-"}`
    },
    {
      title: "仓库 / 操作人",
      key: "operator",
      render: (_, record) => (
        <div>
          <div>{record.warehouseName ?? "-"}</div>
          <div className="documents-secondary-text">{record.operatorName ?? "-"}</div>
        </div>
      )
    }
  ];

  const locationColumns: ColumnsType<InventorySummaryResponse["locationUtilization"][number]> = [
    {
      title: "库位",
      dataIndex: "locationCode",
      width: 160
    },
    {
      title: "区域",
      dataIndex: "zone",
      width: 120,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "已占用",
      dataIndex: "occupiedQuantity",
      width: 100
    },
    {
      title: "冻结",
      dataIndex: "frozenQuantity",
      width: 100
    },
    {
      title: "容量",
      dataIndex: "capacity",
      width: 100,
      render: (value: number | null) => value ?? "-"
    },
    {
      title: "剩余容量",
      dataIndex: "availableCapacity",
      width: 120,
      render: (value: number | null) => value ?? "-"
    },
    {
      title: "占用率",
      dataIndex: "utilizationPercent",
      width: 120,
      render: (value: number | null) => (value !== null ? `${value}%` : "-")
    }
  ];

  const stocktakeColumns: ColumnsType<InventorySummaryResponse["stocktakes"][number]> = [
    {
      title: "盘点单号",
      dataIndex: "stocktakeNo",
      width: 180
    },
    {
      title: "批次 / 仓库",
      key: "batchWarehouse",
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.batchNo}</div>
          <div className="documents-secondary-text">{record.warehouseName}</div>
        </div>
      )
    },
    {
      title: "计划 / 实盘",
      key: "quantities",
      width: 140,
      render: (_, record) => `${record.plannedQuantity} / ${record.actualQuantity}`
    },
    {
      title: "差异",
      dataIndex: "differenceQuantity",
      width: 90
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={value === "COMPLETED" ? "success" : "processing"}>{value}</Tag>
    },
    {
      title: "完成时间",
      dataIndex: "completedAt",
      width: 180,
      render: (value: string | null) => formatDateTime(value)
    }
  ];

  const summary = data?.summary ?? null;

  return (
    <section className="warehouse-inventory-section">
      <Card
        className="placeholder-card"
        title="库存管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新真实库存
          </Button>
        }
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div className="warehouse-inventory-caption">
            <Tag color="geekblue">真实库存</Tag>
            <Typography.Text type="secondary">
              数据来源：`QrItem.status` + `StockMovement`，合同数量只作为业务目标，不会被直接当成库存。
            </Typography.Text>
          </div>

          <Alert
            type={summary?.isConsistent === false ? "warning" : "success"}
            showIcon
            message={summary?.isConsistent === false ? "库存统计与二维码状态存在差异" : "库存统计已与二维码状态对齐"}
            description={
              summary
                ? `实时库存 = 可用库存 + 冻结库存；在途库存 = 待入库二维码。当前累计入库流水 ${summary.totalInboundMovements} 条，累计出库流水 ${summary.totalOutboundMovements} 条。`
                : "库存统计会在二维码生成并发生扫码入库 / 出库后自动展示。"
            }
          />

          {summary ? (
            <div className="document-summary-grid warehouse-inventory-grid">
              <Card className="stat-card">
                <Statistic title="在途库存" value={summary.inTransitInventory} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="实时库存" value={summary.realtimeInventory} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="可用库存" value={summary.availableInventory} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="冻结库存" value={summary.frozenInventory} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="已出库" value={summary.outboundQuantity} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="异常库存" value={summary.abnormalQuantity} suffix="个" />
              </Card>
            </div>
          ) : (
            <Empty description="当前还没有可展示的库存汇总。" />
          )}

          {data ? (
            <div className="document-summary-grid warehouse-mini-grid">
              <Card className="stat-card">
                <Statistic title="最小包装码" value={data.hierarchySummary.unitCount} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="箱码" value={data.hierarchySummary.boxCount} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="托盘码" value={data.hierarchySummary.palletCount} suffix="个" />
              </Card>
              <Card className="stat-card">
                <Statistic title="盘点任务" value={data.stocktakes.length} suffix="单" />
              </Card>
            </div>
          ) : null}

          {data ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card size="small" className="placeholder-card" title="库龄分布">
                  <List
                    size="small"
                    dataSource={data.ageBuckets}
                    renderItem={(item) => (
                      <List.Item>
                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                          <span>{item.label}</span>
                          <strong>{item.quantity}</strong>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card size="small" className="placeholder-card" title="冻结原因统计">
                  <List
                    size="small"
                    dataSource={data.freezeReasons}
                    locale={{ emptyText: "当前没有冻结库存" }}
                    renderItem={(item) => (
                      <List.Item>
                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                          <span>{item.reason}</span>
                          <strong>{item.quantity}</strong>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          ) : null}

          <Tabs
            className="warehouse-inventory-tabs"
            items={[
              {
                key: "batch",
                label: `按批次 (${data?.byBatch.length ?? 0})`,
                children: (
                  <Table
                    rowKey="batchId"
                    size="small"
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    columns={batchColumns}
                    dataSource={data?.byBatch ?? []}
                    rowClassName={(record) => (record.batchId === currentBatchId ? "inventory-table-row-active" : "")}
                    locale={{ emptyText: "当前还没有可统计的批次库存。" }}
                    scroll={{ x: 1440 }}
                  />
                )
              },
              {
                key: "contract",
                label: `按合同 (${data?.byContract.length ?? 0})`,
                children: (
                  <Table
                    rowKey={(record) => record.contractId ?? record.contractNo}
                    size="small"
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    columns={contractColumns}
                    dataSource={data?.byContract ?? []}
                    rowClassName={(record) =>
                      record.contractId && record.contractId === currentContractId ? "inventory-table-row-active" : ""
                    }
                    locale={{ emptyText: "当前还没有可统计的合同库存。" }}
                    scroll={{ x: 1290 }}
                  />
                )
              },
              {
                key: "warehouse",
                label: `按仓库 (${data?.byWarehouse.length ?? 0})`,
                children: (
                  <Table
                    rowKey={(record) => record.warehouseId ?? record.warehouseName}
                    size="small"
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    columns={warehouseColumns}
                    dataSource={data?.byWarehouse ?? []}
                    rowClassName={(record) =>
                      record.warehouseId && record.warehouseId === currentWarehouseId ? "inventory-table-row-active" : ""
                    }
                    locale={{ emptyText: "当前还没有可统计的仓库库存。" }}
                    scroll={{ x: 1080 }}
                  />
                )
              },
              {
                key: "location",
                label: `库位利用率 (${data?.locationUtilization.length ?? 0})`,
                children: (
                  <Table
                    rowKey="locationId"
                    size="small"
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    columns={locationColumns}
                    dataSource={data?.locationUtilization ?? []}
                    locale={{ emptyText: "当前还没有可统计的库位利用率数据。" }}
                    scroll={{ x: 980 }}
                  />
                )
              },
              {
                key: "stocktake",
                label: `盘点记录 (${data?.stocktakes.length ?? 0})`,
                children: (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                    columns={stocktakeColumns}
                    dataSource={data?.stocktakes ?? []}
                    locale={{ emptyText: "当前还没有盘点记录。" }}
                    scroll={{ x: 980 }}
                  />
                )
              }
            ]}
          />
        </Space>
      </Card>

      <Card className="placeholder-card" title="库存流水摘要">
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          columns={movementColumns}
          dataSource={data?.recentMovements ?? []}
          locale={{ emptyText: "当前还没有库存流水记录。" }}
          scroll={{ x: 1240 }}
        />
      </Card>
    </section>
  );
}
