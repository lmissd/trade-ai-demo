import { Prisma, QrItemStatus, StockMovementType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

export const inventoryRouter = Router();

type InventoryMetrics = {
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

function normalizeQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeQueryValue(value[0]);
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

inventoryRouter.get("/summary", async (request, response) => {
  const batchId = normalizeQueryValue(request.query.batchId);
  const contractId = normalizeQueryValue(request.query.contractId);
  const warehouseId = normalizeQueryValue(request.query.warehouseId);

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

  const [qrItems, recentMovements, totalInboundMovements, totalOutboundMovements] = await Promise.all([
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
    })
  ]);

  const summary = createEmptyMetrics();
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

  for (const qrItem of qrItems) {
    addQrStatus(summary, qrItem.status);

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

  response.json({
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
  });
});
