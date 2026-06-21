import { Prisma, QrItemStatus, StockMovementType } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type InventoryMetrics = {
  totalQrItems: number;
  inTransitInventory: number;
  realtimeInventory: number;
  availableInventory: number;
  frozenInventory: number;
  outboundQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  abnormalQuantity: number;
};

export type InventoryFilters = {
  batchId?: string | null;
  contractId?: string | null;
  warehouseId?: string | null;
};

export type InventorySummaryResult = {
  generatedAt: string;
  filters: {
    batchId: string | null;
    contractId: string | null;
    warehouseId: string | null;
  };
  summary: InventoryMetrics & {
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
    createdAt: Date;
    completedAt: Date | null;
  }>;
  byBatch: Array<
    InventoryMetrics & {
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
      latestStatusChangedAt: Date;
    }
  >;
  byContract: Array<
    InventoryMetrics & {
      contractId: string | null;
      contractNo: string;
      customerName: string;
      supplierName: string;
      contractQuantity: number | null;
      unit: string | null;
      batchCount: number;
      warehouseCount: number;
    }
  >;
  byWarehouse: Array<
    InventoryMetrics & {
      warehouseId: string | null;
      warehouseName: string;
      contractCount: number;
      batchCount: number;
    }
  >;
  recentMovements: Array<{
    id: string;
    movementType: StockMovementType;
    fromStatus: string | null;
    toStatus: string | null;
    warehouseName: string | null;
    operatorName: string | null;
    occurredAt: Date;
    qrCode: string;
    productName: string | null;
    batchNo: string;
    contractNo: string;
  }>;
};

export function normalizeInventoryQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeInventoryQueryValue(value[0]);
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createEmptyMetrics(): InventoryMetrics {
  return {
    totalQrItems: 0,
    inTransitInventory: 0,
    realtimeInventory: 0,
    availableInventory: 0,
    frozenInventory: 0,
    outboundQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    abnormalQuantity: 0
  };
}

function appendAndFilter(where: Prisma.QrItemWhereInput, filter: Prisma.QrItemWhereInput) {
  if (!where.AND) {
    where.AND = [filter];
    return;
  }

  where.AND = Array.isArray(where.AND) ? [...where.AND, filter] : [where.AND, filter];
}

function addQrStatus(metrics: InventoryMetrics, status: QrItemStatus) {
  metrics.totalQrItems += 1;

  switch (status) {
    case QrItemStatus.PENDING_INBOUND:
      metrics.inTransitInventory += 1;
      break;
    case QrItemStatus.IN_STOCK:
      metrics.availableInventory += 1;
      metrics.realtimeInventory += 1;
      break;
    case QrItemStatus.FROZEN:
      metrics.frozenInventory += 1;
      metrics.realtimeInventory += 1;
      break;
    case QrItemStatus.OUTBOUND:
      metrics.outboundQuantity += 1;
      break;
    case QrItemStatus.DAMAGED:
      metrics.damagedQuantity += 1;
      metrics.abnormalQuantity += 1;
      break;
    case QrItemStatus.LOST:
      metrics.lostQuantity += 1;
      metrics.abnormalQuantity += 1;
      break;
    default:
      break;
  }
}

function createAgeBuckets() {
  return [
    { key: "0_7", label: "0-7天", quantity: 0 },
    { key: "8_30", label: "8-30天", quantity: 0 },
    { key: "31_PLUS", label: "31天以上", quantity: 0 }
  ];
}

function addAgeBucket(
  buckets: ReturnType<typeof createAgeBuckets>,
  inboundAt: Date | null,
  now: Date
) {
  if (!inboundAt) {
    return;
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - inboundAt.getTime()) / (24 * 60 * 60 * 1000)));

  if (ageDays <= 7) {
    buckets[0].quantity += 1;
    return;
  }

  if (ageDays <= 30) {
    buckets[1].quantity += 1;
    return;
  }

  buckets[2].quantity += 1;
}

export async function buildInventorySummary(filters: InventoryFilters = {}): Promise<InventorySummaryResult> {
  const batchId = filters.batchId?.trim() || null;
  const contractId = filters.contractId?.trim() || null;
  const warehouseId = filters.warehouseId?.trim() || null;

  const qrWhere: Prisma.QrItemWhereInput = {};

  if (batchId) {
    qrWhere.batchId = batchId;
  }

  if (contractId) {
    appendAndFilter(qrWhere, {
      OR: [{ contractId }, { batch: { is: { contractId } } }]
    });
  }

  if (warehouseId) {
    appendAndFilter(qrWhere, {
      OR: [{ warehouseId }, { batch: { is: { warehouseId } } }]
    });
  }

  const movementWhere: Prisma.StockMovementWhereInput = {
    ...(batchId ? { batchId } : {}),
    ...(contractId ? { contractId } : {}),
    ...(warehouseId ? { warehouseId } : {})
  };

  const [qrItems, recentMovements, totalInboundMovements, totalOutboundMovements, locations, stocktakeOrders] =
    await Promise.all([
    prisma.qrItem.findMany({
      where: qrWhere,
      orderBy: [{ batchId: "asc" }, { serialNo: "asc" }],
      select: {
        id: true,
        batchId: true,
        contractId: true,
        status: true,
        currentWarehouse: true,
        warehouseId: true,
        locationId: true,
        unitTraceCode: true,
        boxTraceCode: true,
        palletTraceCode: true,
        inboundAt: true,
        freezeReason: true,
        updatedAt: true,
        batch: {
          select: {
            id: true,
            batchNo: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            status: true,
            warehouseId: true,
            destinationWarehouse: true,
            createdAt: true,
            contract: {
              select: {
                id: true,
                contractNo: true,
                customerName: true,
                supplierName: true,
                totalQuantity: true,
                unit: true
              }
            }
          }
        }
      }
    }),
    prisma.stockMovement.findMany({
      where: movementWhere,
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: {
        id: true,
        movementType: true,
        fromStatus: true,
        toStatus: true,
        warehouseName: true,
        operatorName: true,
        occurredAt: true,
        qrItem: {
          select: {
            qrCode: true,
            productName: true
          }
        },
        batch: {
          select: {
            batchNo: true
          }
        },
        contract: {
          select: {
            contractNo: true
          }
        }
      }
    }),
    prisma.stockMovement.count({
      where: {
        ...movementWhere,
        movementType: StockMovementType.INBOUND
      }
    }),
    prisma.stockMovement.count({
      where: {
        ...movementWhere,
        movementType: StockMovementType.OUTBOUND
      }
    }),
    prisma.warehouseLocation.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {})
      },
      orderBy: [{ warehouseId: "asc" }, { zone: "asc" }, { locationCode: "asc" }],
      select: {
        id: true,
        warehouseId: true,
        locationCode: true,
        zone: true,
        capacity: true
      }
    }),
    prisma.stocktakeOrder.findMany({
      where: {
        ...(batchId ? { batchId } : {}),
        ...(contractId ? { contractId } : {}),
        ...(warehouseId ? { warehouseId } : {})
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        stocktakeNo: true,
        status: true,
        batchId: true,
        warehouseId: true,
        plannedQuantity: true,
        actualQuantity: true,
        differenceQuantity: true,
        operatorName: true,
        createdAt: true,
        completedAt: true,
        batch: {
          select: {
            batchNo: true
          }
        }
      }
    })
  ]);

  const summary = createEmptyMetrics();
  const now = new Date();
  const hierarchySummary = {
    unitCount: 0,
    boxCount: 0,
    palletCount: 0
  };
  const ageBuckets = createAgeBuckets();
  const unitCodeSet = new Set<string>();
  const boxCodeSet = new Set<string>();
  const palletCodeSet = new Set<string>();
  const freezeReasonMap = new Map<string, number>();
  const locationMap = new Map<
    string,
    {
      locationId: string;
      warehouseId: string | null;
      locationCode: string;
      zone: string | null;
      capacity: number | null;
      occupiedQuantity: number;
      frozenQuantity: number;
    }
  >();
  const batchMap = new Map<
    string,
    {
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
      latestStatusChangedAt: Date;
      metrics: InventoryMetrics;
    }
  >();
  const contractMap = new Map<
    string,
    {
      contractId: string | null;
      contractNo: string;
      customerName: string;
      supplierName: string;
      contractQuantity: number | null;
      unit: string | null;
      batchIds: Set<string>;
      warehouseIds: Set<string>;
      metrics: InventoryMetrics;
    }
  >();
  const warehouseMap = new Map<
    string,
    {
      warehouseId: string | null;
      warehouseName: string;
      contractIds: Set<string>;
      batchIds: Set<string>;
      metrics: InventoryMetrics;
    }
  >();

  for (const location of locations) {
    locationMap.set(location.id, {
      locationId: location.id,
      warehouseId: location.warehouseId,
      locationCode: location.locationCode,
      zone: location.zone,
      capacity: location.capacity,
      occupiedQuantity: 0,
      frozenQuantity: 0
    });
  }

  for (const qrItem of qrItems) {
    addQrStatus(summary, qrItem.status);

    if (qrItem.unitTraceCode) {
      unitCodeSet.add(qrItem.unitTraceCode);
    }

    if (qrItem.boxTraceCode) {
      boxCodeSet.add(qrItem.boxTraceCode);
    }

    if (qrItem.palletTraceCode) {
      palletCodeSet.add(qrItem.palletTraceCode);
    }

    if (qrItem.status === QrItemStatus.IN_STOCK || qrItem.status === QrItemStatus.FROZEN) {
      addAgeBucket(ageBuckets, qrItem.inboundAt, now);

      if (qrItem.locationId && locationMap.has(qrItem.locationId)) {
        const locationEntry = locationMap.get(qrItem.locationId)!;
        locationEntry.occupiedQuantity += 1;

        if (qrItem.status === QrItemStatus.FROZEN) {
          locationEntry.frozenQuantity += 1;
        }
      }
    }

    if (qrItem.status === QrItemStatus.FROZEN) {
      const reason = qrItem.freezeReason?.trim() || "未填写冻结原因";
      freezeReasonMap.set(reason, (freezeReasonMap.get(reason) ?? 0) + 1);
    }

    const batch = qrItem.batch;
    const contract = batch.contract;
    const resolvedContractId = contract?.id ?? qrItem.contractId ?? null;
    const resolvedContractNo = contract?.contractNo ?? "未关联合同";
    const resolvedWarehouseId = qrItem.warehouseId ?? batch.warehouseId ?? null;
    const resolvedWarehouseName = qrItem.currentWarehouse ?? batch.destinationWarehouse ?? "未分配仓库";

    const batchEntry =
      batchMap.get(batch.id) ??
      {
        batchId: batch.id,
        batchNo: batch.batchNo,
        batchStatus: batch.status,
        contractId: resolvedContractId,
        contractNo: resolvedContractNo,
        productName: batch.productName,
        batchQuantity: batch.totalQuantity,
        unit: batch.unit,
        warehouseId: resolvedWarehouseId,
        warehouseName: resolvedWarehouseName,
        latestStatusChangedAt: qrItem.updatedAt,
        metrics: createEmptyMetrics()
      };
    addQrStatus(batchEntry.metrics, qrItem.status);
    if (qrItem.updatedAt > batchEntry.latestStatusChangedAt) {
      batchEntry.latestStatusChangedAt = qrItem.updatedAt;
    }
    batchMap.set(batch.id, batchEntry);

    const contractKey = resolvedContractId ?? `UNLINKED:${resolvedContractNo}`;
    const contractEntry =
      contractMap.get(contractKey) ??
      {
        contractId: resolvedContractId,
        contractNo: resolvedContractNo,
        customerName: contract?.customerName ?? "-",
        supplierName: contract?.supplierName ?? "-",
        contractQuantity: contract?.totalQuantity ?? null,
        unit: contract?.unit ?? batch.unit,
        batchIds: new Set<string>(),
        warehouseIds: new Set<string>(),
        metrics: createEmptyMetrics()
      };
    contractEntry.batchIds.add(batch.id);
    if (resolvedWarehouseId) {
      contractEntry.warehouseIds.add(resolvedWarehouseId);
    }
    addQrStatus(contractEntry.metrics, qrItem.status);
    contractMap.set(contractKey, contractEntry);

    const warehouseKey = resolvedWarehouseId ?? `UNASSIGNED:${resolvedWarehouseName}`;
    const warehouseEntry =
      warehouseMap.get(warehouseKey) ??
      {
        warehouseId: resolvedWarehouseId,
        warehouseName: resolvedWarehouseName,
        contractIds: new Set<string>(),
        batchIds: new Set<string>(),
        metrics: createEmptyMetrics()
      };
    warehouseEntry.batchIds.add(batch.id);
    if (resolvedContractId) {
      warehouseEntry.contractIds.add(resolvedContractId);
    }
    addQrStatus(warehouseEntry.metrics, qrItem.status);
    warehouseMap.set(warehouseKey, warehouseEntry);
  }

  hierarchySummary.unitCount = unitCodeSet.size;
  hierarchySummary.boxCount = boxCodeSet.size;
  hierarchySummary.palletCount = palletCodeSet.size;

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      batchId,
      contractId,
      warehouseId
    },
    summary: {
      ...summary,
      totalInboundMovements,
      totalOutboundMovements,
      statusAccountedQuantity:
        summary.inTransitInventory +
        summary.realtimeInventory +
        summary.outboundQuantity +
        summary.abnormalQuantity,
      isConsistent:
        summary.inTransitInventory + summary.realtimeInventory + summary.outboundQuantity + summary.abnormalQuantity ===
        summary.totalQrItems
    },
    hierarchySummary,
    ageBuckets,
    locationUtilization: [...locationMap.values()]
      .map((entry) => ({
        ...entry,
        availableCapacity: entry.capacity !== null ? Math.max(entry.capacity - entry.occupiedQuantity, 0) : null,
        utilizationPercent:
          entry.capacity && entry.capacity > 0
            ? Number(((entry.occupiedQuantity / entry.capacity) * 100).toFixed(1))
            : null
      }))
      .sort((left, right) => left.locationCode.localeCompare(right.locationCode, "zh-CN")),
    freezeReasons: [...freezeReasonMap.entries()]
      .map(([reason, quantity]) => ({ reason, quantity }))
      .sort((left, right) => right.quantity - left.quantity),
    stocktakes: stocktakeOrders.map((item) => ({
      id: item.id,
      stocktakeNo: item.stocktakeNo,
      status: item.status,
      batchId: item.batchId,
      batchNo: item.batch?.batchNo ?? "-",
      warehouseId: item.warehouseId,
      warehouseName: qrItems.find((qr) => qr.warehouseId === item.warehouseId)?.currentWarehouse ?? "未分配仓库",
      plannedQuantity: item.plannedQuantity,
      actualQuantity: item.actualQuantity,
      differenceQuantity: item.differenceQuantity,
      operatorName: item.operatorName,
      createdAt: item.createdAt,
      completedAt: item.completedAt
    })),
    byBatch: [...batchMap.values()]
      .sort((left, right) => right.latestStatusChangedAt.getTime() - left.latestStatusChangedAt.getTime())
      .map((entry) => ({
        batchId: entry.batchId,
        batchNo: entry.batchNo,
        batchStatus: entry.batchStatus,
        contractId: entry.contractId,
        contractNo: entry.contractNo,
        productName: entry.productName,
        batchQuantity: entry.batchQuantity,
        unit: entry.unit,
        warehouseId: entry.warehouseId,
        warehouseName: entry.warehouseName,
        latestStatusChangedAt: entry.latestStatusChangedAt,
        ...entry.metrics
      })),
    byContract: [...contractMap.values()]
      .sort((left, right) => right.metrics.realtimeInventory - left.metrics.realtimeInventory)
      .map((entry) => ({
        contractId: entry.contractId,
        contractNo: entry.contractNo,
        customerName: entry.customerName,
        supplierName: entry.supplierName,
        contractQuantity: entry.contractQuantity,
        unit: entry.unit,
        batchCount: entry.batchIds.size,
        warehouseCount: entry.warehouseIds.size,
        ...entry.metrics
      })),
    byWarehouse: [...warehouseMap.values()]
      .sort((left, right) => right.metrics.realtimeInventory - left.metrics.realtimeInventory)
      .map((entry) => ({
        warehouseId: entry.warehouseId,
        warehouseName: entry.warehouseName,
        contractCount: entry.contractIds.size,
        batchCount: entry.batchIds.size,
        ...entry.metrics
      })),
    recentMovements: recentMovements.map((movement) => ({
      id: movement.id,
      movementType: movement.movementType,
      fromStatus: movement.fromStatus,
      toStatus: movement.toStatus,
      warehouseName: movement.warehouseName,
      operatorName: movement.operatorName,
      occurredAt: movement.occurredAt,
      qrCode: movement.qrItem.qrCode,
      productName: movement.qrItem.productName,
      batchNo: movement.batch.batchNo,
      contractNo: movement.contract.contractNo
    }))
  };
}
