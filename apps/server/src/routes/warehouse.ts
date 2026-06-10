import { BatchStatus, QrItemStatus, StockMovementType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

export const warehouseRouter = Router();

type ScanOperationType = "INBOUND" | "OUTBOUND";

type WarehouseContextPayload = {
  mode: ScanOperationType;
  batchId?: string;
};

type ScanPreviewPayload = {
  mode?: ScanOperationType;
  qrCode?: string;
  batchId?: string;
  taskId?: string;
  contractId?: string;
  warehouseId?: string;
  locationId?: string | null;
};

type ConfirmScanPayload = {
  mode?: ScanOperationType;
  qrItemId?: string;
  batchId?: string;
  taskId?: string;
  contractId?: string;
  warehouseId?: string;
  locationId?: string | null;
};

type BulkScanPayload = {
  mode?: ScanOperationType;
  batchId?: string;
  taskId?: string;
  contractId?: string;
  warehouseId?: string;
  quantity?: number;
  locationId?: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(status: QrItemStatus) {
  const statusMap: Record<QrItemStatus, string> = {
    PENDING_INBOUND: "待入库",
    IN_STOCK: "在库",
    OUTBOUND: "已出库",
    DAMAGED: "损坏",
    LOST: "丢失",
    FROZEN: "冻结"
  };

  return statusMap[status] ?? status;
}

function normalizeOperationType(value: unknown): ScanOperationType | null {
  return value === "INBOUND" || value === "OUTBOUND" ? value : null;
}

function ensurePositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

async function resolveOperator() {
  return prisma.user.findUnique({
    where: { username: "demo-owner" },
    select: {
      id: true,
      displayName: true
    }
  });
}

async function ensureWarehouseTaskContext(mode: ScanOperationType, batchId?: string | null) {
  const activeDemoConfig = await prisma.demoConfig.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" }
  });

  const preferredBatchWhere =
    mode === "INBOUND"
      ? {
          qrItems: {
            some: { status: QrItemStatus.PENDING_INBOUND }
          }
        }
      : {
          qrItems: {
            some: {}
          }
        };

  const resolvedBatch =
    (batchId
      ? await prisma.batch.findUnique({
          where: { id: batchId },
          include: {
            contract: {
              select: {
                id: true,
                contractNo: true,
                customerName: true,
                supplierName: true,
                totalQuantity: true,
                amount: true,
                currency: true
              }
            }
          }
        })
      : null) ??
    (await prisma.batch.findFirst({
      where: preferredBatchWhere,
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            totalQuantity: true,
            amount: true,
            currency: true
          }
        }
      }
    })) ??
    (await prisma.batch.findFirst({
      where: {
        qrItems: {
          some: {}
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            totalQuantity: true,
            amount: true,
            currency: true
          }
        }
      }
    })) ??
    (await prisma.batch.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            totalQuantity: true,
            amount: true,
            currency: true
          }
        }
      }
    }));

  if (!resolvedBatch) {
    throw new Error(mode === "INBOUND" ? "当前没有可执行扫码入库的批次。" : "当前没有可执行扫码出库的批次。");
  }

  const warehouse = resolvedBatch.warehouseId
    ? await prisma.warehouse.findUnique({
        where: { id: resolvedBatch.warehouseId }
      })
    : activeDemoConfig?.warehouseId
      ? await prisma.warehouse.findUnique({
          where: { id: activeDemoConfig.warehouseId }
        })
      : await prisma.warehouse.findFirst({
          orderBy: { createdAt: "asc" }
        });

  if (!warehouse) {
    throw new Error("当前没有可用仓库，请先检查阶段 2 的演示基础数据。");
  }

  const locations = await prisma.warehouseLocation.findMany({
    where: { warehouseId: warehouse.id },
    orderBy: [{ zone: "asc" }, { locationCode: "asc" }]
  });

  const suggestedLocation = locations[0] ?? null;

  let preReceiveOrder = await prisma.preReceiveOrder.findFirst({
    where: {
      batchId: resolvedBatch.id,
      warehouseId: warehouse.id
    },
    orderBy: { createdAt: "desc" }
  });

  if (!preReceiveOrder) {
    preReceiveOrder = await prisma.preReceiveOrder.create({
      data: {
        preReceiveNo: `PR-${resolvedBatch.batchNo}`,
        contractId: resolvedBatch.contractId,
        batchId: resolvedBatch.id,
        warehouseId: warehouse.id,
        expectedArrivalTime: new Date(),
        skuName: resolvedBatch.productName,
        quantity: resolvedBatch.totalQuantity,
        unit: resolvedBatch.unit,
        suggestedLocation: suggestedLocation?.locationCode ?? warehouse.name,
        status: "READY"
      }
    });
  }

  let inboundOrder = await prisma.inboundOrder.findFirst({
    where: {
      batchId: resolvedBatch.id,
      warehouseId: warehouse.id
    },
    orderBy: { createdAt: "desc" }
  });

  if (!inboundOrder) {
    inboundOrder = await prisma.inboundOrder.create({
      data: {
        inboundNo: `IN-${resolvedBatch.batchNo}`,
        contractId: resolvedBatch.contractId,
        batchId: resolvedBatch.id,
        warehouseId: warehouse.id,
        quantity: resolvedBatch.totalQuantity,
        unit: resolvedBatch.unit,
        status: "READY"
      }
    });
  }

  let salesOrder = await prisma.salesOrder.findFirst({
    where: { batchId: resolvedBatch.id },
    orderBy: { createdAt: "desc" }
  });

  if (!salesOrder) {
    const plannedOutboundQuantity = activeDemoConfig?.plannedOutboundQuantity ?? Math.min(20, resolvedBatch.totalQuantity);
    const totalContractQuantity = Math.max(resolvedBatch.contract.totalQuantity, 1);
    const salesAmount = Number(
      ((resolvedBatch.contract.amount * plannedOutboundQuantity) / totalContractQuantity).toFixed(2)
    );

    salesOrder = await prisma.salesOrder.create({
      data: {
        salesNo: `SO-${resolvedBatch.batchNo}`,
        contractId: resolvedBatch.contractId,
        batchId: resolvedBatch.id,
        customerId: activeDemoConfig?.customerId ?? undefined,
        customerName: resolvedBatch.contract.customerName,
        companyId: null,
        skuName: resolvedBatch.productName,
        quantity: plannedOutboundQuantity,
        unit: resolvedBatch.unit,
        amount: salesAmount,
        currency: resolvedBatch.contract.currency,
        deliveryMethod: "当地配送",
        deliveryStatus: "READY",
        signStatus: "UNSIGNED",
        status: "READY"
      }
    });
  }

  let outboundOrder = await prisma.outboundOrder.findFirst({
    where: {
      batchId: resolvedBatch.id,
      warehouseId: warehouse.id
    },
    orderBy: { createdAt: "desc" }
  });

  if (!outboundOrder) {
    const outboundQuantity = salesOrder.quantity;

    outboundOrder = await prisma.outboundOrder.create({
      data: {
        outboundNo: `OUT-${resolvedBatch.batchNo}`,
        salesOrderId: salesOrder.id,
        contractId: resolvedBatch.contractId,
        batchId: resolvedBatch.id,
        warehouseId: warehouse.id,
        quantity: outboundQuantity,
        unit: resolvedBatch.unit,
        status: "READY"
      }
    });
  }

  return {
    batch: resolvedBatch,
    contract: resolvedBatch.contract,
    warehouse,
    locations,
    suggestedLocation,
    preReceiveOrder,
    inboundOrder,
    salesOrder,
    outboundOrder,
    activeDemoConfig
  };
}

async function buildWarehouseContext(mode: ScanOperationType, batchId?: string | null) {
  const context = await ensureWarehouseTaskContext(mode, batchId);
  const qrItems = await prisma.qrItem.findMany({
    where: { batchId: context.batch.id },
    orderBy: [{ serialNo: "asc" }]
  });

  const recentStockMovements = await prisma.stockMovement.findMany({
    where: {
      batchId: context.batch.id,
      movementType: mode === "INBOUND" ? StockMovementType.INBOUND : StockMovementType.OUTBOUND
    },
    orderBy: { occurredAt: "desc" },
    take: 8,
    include: {
      qrItem: {
        select: {
          qrCode: true,
          productName: true,
          status: true
        }
      }
    }
  });

  const task = mode === "INBOUND" ? context.inboundOrder : context.outboundOrder;
  const targetQuantity = task.quantity;
  const scannedQuantity =
    mode === "INBOUND"
      ? qrItems.filter((item) => item.status === QrItemStatus.IN_STOCK || item.status === QrItemStatus.OUTBOUND).length
      : qrItems.filter((item) => item.status === QrItemStatus.OUTBOUND).length;

  return {
    mode,
    task: {
      id: task.id,
      taskNo: mode === "INBOUND" ? context.preReceiveOrder.preReceiveNo : context.outboundOrder.outboundNo,
      orderNo: mode === "INBOUND" ? context.inboundOrder.inboundNo : context.outboundOrder.outboundNo,
      type: mode === "INBOUND" ? "预收货 / 入库任务" : "销售出库任务",
      status: task.status
    },
    batch: {
      id: context.batch.id,
      batchNo: context.batch.batchNo,
      status: context.batch.status,
      totalQuantity: context.batch.totalQuantity,
      unit: context.batch.unit,
      productName: context.batch.productName
    },
    contract: {
      id: context.contract.id,
      contractNo: context.contract.contractNo,
      customerName: context.contract.customerName,
      supplierName: context.contract.supplierName
    },
    warehouse: {
      id: context.warehouse.id,
      warehouseCode: context.warehouse.warehouseCode,
      name: context.warehouse.name,
      country: context.warehouse.country,
      city: context.warehouse.city,
      locationId: context.suggestedLocation?.id ?? null,
      locationCode: context.suggestedLocation?.locationCode ?? null
    },
    quantities: {
      target: targetQuantity,
      scanned: Math.min(scannedQuantity, targetQuantity),
      remaining: Math.max(targetQuantity - scannedQuantity, 0),
      pendingInbound: qrItems.filter((item) => item.status === QrItemStatus.PENDING_INBOUND).length,
      inStock: qrItems.filter((item) => item.status === QrItemStatus.IN_STOCK).length,
      outbound: qrItems.filter((item) => item.status === QrItemStatus.OUTBOUND).length,
      frozen: qrItems.filter((item) => item.status === QrItemStatus.FROZEN).length
    },
    qrSummary: {
      total: qrItems.length,
      pendingInbound: qrItems.filter((item) => item.status === QrItemStatus.PENDING_INBOUND).length,
      inStock: qrItems.filter((item) => item.status === QrItemStatus.IN_STOCK).length,
      outbound: qrItems.filter((item) => item.status === QrItemStatus.OUTBOUND).length,
      damaged: qrItems.filter((item) => item.status === QrItemStatus.DAMAGED).length,
      lost: qrItems.filter((item) => item.status === QrItemStatus.LOST).length,
      frozen: qrItems.filter((item) => item.status === QrItemStatus.FROZEN).length
    },
    locations: context.locations.map((location) => ({
      id: location.id,
      locationCode: location.locationCode,
      zone: location.zone,
      status: location.status
    })),
    recentScanRecords: recentStockMovements.map((movement) => ({
      id: movement.id,
      qrCode: movement.qrItem.qrCode,
      productName: movement.qrItem.productName,
      movementType: movement.movementType,
      fromStatus: movement.fromStatus,
      toStatus: movement.toStatus,
      warehouseName: movement.warehouseName,
      operatorName: movement.operatorName,
      occurredAt: movement.occurredAt,
      note: movement.note,
      remark: movement.remark
    }))
  };
}

function createQrSummaryBucket() {
  return {
    total: 0,
    pendingInbound: 0,
    inStock: 0,
    outbound: 0,
    frozen: 0,
    damaged: 0,
    lost: 0
  };
}

function collectQrSummaryByBatch(
  qrItems: Array<{
    batchId: string | null;
    status: QrItemStatus;
  }>
) {
  const summaryByBatch = new Map<string, ReturnType<typeof createQrSummaryBucket>>();

  for (const item of qrItems) {
    if (!item.batchId) {
      continue;
    }

    const bucket = summaryByBatch.get(item.batchId) ?? createQrSummaryBucket();
    bucket.total += 1;

    if (item.status === QrItemStatus.PENDING_INBOUND) {
      bucket.pendingInbound += 1;
    } else if (item.status === QrItemStatus.IN_STOCK) {
      bucket.inStock += 1;
    } else if (item.status === QrItemStatus.OUTBOUND) {
      bucket.outbound += 1;
    } else if (item.status === QrItemStatus.FROZEN) {
      bucket.frozen += 1;
    } else if (item.status === QrItemStatus.DAMAGED) {
      bucket.damaged += 1;
    } else if (item.status === QrItemStatus.LOST) {
      bucket.lost += 1;
    }

    summaryByBatch.set(item.batchId, bucket);
  }

  return summaryByBatch;
}

async function buildWarehouseWorkbench(batchId?: string | null) {
  const inboundFocus = await ensureWarehouseTaskContext("INBOUND", batchId);
  const outboundFocus = await ensureWarehouseTaskContext("OUTBOUND", inboundFocus.batch.id);

  const [preReceiveOrders, inboundOrders, outboundOrders, salesOrders, batches, contracts, warehouses, locations] =
    await Promise.all([
      prisma.preReceiveOrder.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.inboundOrder.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.outboundOrder.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.salesOrder.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.batch.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.contract.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.warehouse.findMany({
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.warehouseLocation.findMany({
        orderBy: [{ warehouseId: "asc" }, { zone: "asc" }, { locationCode: "asc" }]
      })
    ]);

  const batchIdSet = new Set<string>();

  for (const order of preReceiveOrders) {
    if (order.batchId) {
      batchIdSet.add(order.batchId);
    }
  }

  for (const order of outboundOrders) {
    if (order.batchId) {
      batchIdSet.add(order.batchId);
    }
  }

  const qrItems =
    batchIdSet.size > 0
      ? await prisma.qrItem.findMany({
          where: {
            batchId: {
              in: Array.from(batchIdSet)
            }
          },
          select: {
            batchId: true,
            status: true
          }
        })
      : [];

  const qrSummaryByBatch = collectQrSummaryByBatch(qrItems);
  const inboundOrderByBatchWarehouse = new Map<string, (typeof inboundOrders)[number]>();
  const salesOrderById = new Map<string, (typeof salesOrders)[number]>();
  const batchById = new Map<string, (typeof batches)[number]>();
  const contractById = new Map<string, (typeof contracts)[number]>();
  const warehouseById = new Map<string, (typeof warehouses)[number]>();

  for (const item of inboundOrders) {
    const key = `${item.batchId ?? ""}:${item.warehouseId ?? ""}`;
    if (!inboundOrderByBatchWarehouse.has(key)) {
      inboundOrderByBatchWarehouse.set(key, item);
    }
  }

  for (const item of salesOrders) {
    salesOrderById.set(item.id, item);
  }

  for (const item of batches) {
    batchById.set(item.id, item);
  }

  for (const item of contracts) {
    contractById.set(item.id, item);
  }

  for (const item of warehouses) {
    warehouseById.set(item.id, item);
  }

  const preReceiveRows = preReceiveOrders.map((order) => {
    const batch = order.batchId ? batchById.get(order.batchId) ?? null : null;
    const contract = order.contractId ? contractById.get(order.contractId) ?? null : null;
    const warehouse = order.warehouseId ? warehouseById.get(order.warehouseId) ?? null : null;
    const relatedInboundOrder =
      inboundOrderByBatchWarehouse.get(`${order.batchId ?? ""}:${order.warehouseId ?? ""}`) ?? null;
    const qrSummary = order.batchId ? qrSummaryByBatch.get(order.batchId) ?? createQrSummaryBucket() : createQrSummaryBucket();
    const scannedQuantity = Math.min(qrSummary.inStock + qrSummary.outbound, order.quantity);

    return {
      id: order.id,
      preReceiveNo: order.preReceiveNo,
      expectedArrivalTime: order.expectedArrivalTime,
      skuName: order.skuName,
      quantity: order.quantity,
      unit: order.unit,
      suggestedLocation: order.suggestedLocation,
      status: order.status,
      batchId: order.batchId,
      batchNo: batch?.batchNo ?? "-",
      batchStatus: batch?.status ?? null,
      contractId: order.contractId,
      contractNo: contract?.contractNo ?? "-",
      warehouseId: order.warehouseId,
      warehouseName: warehouse?.name ?? "-",
      inboundNo: relatedInboundOrder?.inboundNo ?? "-",
      scannedQuantity,
      remainingQuantity: Math.max(order.quantity - scannedQuantity, 0),
      qrSummary,
      updatedAt: order.updatedAt
    };
  });

  const outboundRows = outboundOrders.map((order) => {
    const batch = order.batchId ? batchById.get(order.batchId) ?? null : null;
    const contract = order.contractId ? contractById.get(order.contractId) ?? null : null;
    const warehouse = order.warehouseId ? warehouseById.get(order.warehouseId) ?? null : null;
    const salesOrder = order.salesOrderId ? salesOrderById.get(order.salesOrderId) ?? null : null;
    const qrSummary = order.batchId ? qrSummaryByBatch.get(order.batchId) ?? createQrSummaryBucket() : createQrSummaryBucket();
    const scannedQuantity = Math.min(qrSummary.outbound, order.quantity);

    return {
      id: order.id,
      outboundNo: order.outboundNo,
      status: order.status,
      quantity: order.quantity,
      unit: order.unit,
      batchId: order.batchId,
      batchNo: batch?.batchNo ?? "-",
      batchStatus: batch?.status ?? null,
      contractId: order.contractId,
      contractNo: contract?.contractNo ?? "-",
      warehouseId: order.warehouseId,
      warehouseName: warehouse?.name ?? "-",
      salesOrderId: order.salesOrderId,
      salesNo: salesOrder?.salesNo ?? "-",
      customerName: salesOrder?.customerName ?? contract?.customerName ?? "-",
      skuName: salesOrder?.skuName ?? batch?.productName ?? "-",
      deliveryMethod: salesOrder?.deliveryMethod ?? null,
      deliveryStatus: salesOrder?.deliveryStatus ?? null,
      signStatus: salesOrder?.signStatus ?? null,
      scannedQuantity,
      remainingQuantity: Math.max(order.quantity - scannedQuantity, 0),
      inStockAvailable: qrSummary.inStock,
      qrSummary,
      updatedAt: order.updatedAt
    };
  });

  const allQrSummary = qrItems.reduce(
    (accumulator, item) => {
      accumulator.total += 1;

      if (item.status === QrItemStatus.PENDING_INBOUND) {
        accumulator.pendingInbound += 1;
      } else if (item.status === QrItemStatus.IN_STOCK) {
        accumulator.inStock += 1;
      } else if (item.status === QrItemStatus.OUTBOUND) {
        accumulator.outbound += 1;
      } else if (item.status === QrItemStatus.FROZEN) {
        accumulator.frozen += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      pendingInbound: 0,
      inStock: 0,
      outbound: 0,
      frozen: 0
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    focus: {
      batchId: inboundFocus.batch.id,
      batchNo: inboundFocus.batch.batchNo,
      contractId: inboundFocus.contract.id,
      contractNo: inboundFocus.contract.contractNo,
      warehouseId: inboundFocus.warehouse.id,
      warehouseName: inboundFocus.warehouse.name
    },
    summary: {
      preReceiveTotal: preReceiveRows.length,
      preReceiveReady: preReceiveRows.filter((item) => item.status === "READY" || item.status === "PENDING").length,
      preReceiveInProgress: preReceiveRows.filter((item) => item.status === "IN_PROGRESS").length,
      preReceiveCompleted: preReceiveRows.filter((item) => item.status === "COMPLETED").length,
      outboundTotal: outboundRows.length,
      outboundReady: outboundRows.filter((item) => item.status === "READY" || item.status === "PENDING").length,
      outboundInProgress: outboundRows.filter((item) => item.status === "IN_PROGRESS").length,
      outboundCompleted: outboundRows.filter((item) => item.status === "COMPLETED").length,
      pendingInboundQrCount: allQrSummary.pendingInbound,
      inStockQrCount: allQrSummary.inStock,
      outboundQrCount: allQrSummary.outbound,
      frozenQrCount: allQrSummary.frozen,
      warehouseCount: new Set(
        [...preReceiveRows.map((item) => item.warehouseId), ...outboundRows.map((item) => item.warehouseId)].filter(Boolean)
      ).size
    },
    preReceiveOrders: preReceiveRows,
    outboundOrders: outboundRows,
    locationSnapshots: locations.map((location) => ({
      id: location.id,
      warehouseId: location.warehouseId,
      warehouseName:
        (location.warehouseId ? warehouseById.get(location.warehouseId)?.name : null) ?? "未绑定仓库",
      locationCode: location.locationCode,
      zone: location.zone,
      status: location.status,
      isFocusWarehouse: location.warehouseId === inboundFocus.warehouse.id,
      isSuggestedForInbound: location.id === inboundFocus.suggestedLocation?.id,
      isSuggestedForOutbound: location.id === outboundFocus.suggestedLocation?.id
    }))
  };
}

async function createWarehouseMutation(
  mode: ScanOperationType,
  qrCode: string,
  contextArgs: {
    batchId: string;
    taskId: string;
    contractId: string;
    warehouseId: string;
    locationId?: string | null;
  }
) {
  const context = await ensureWarehouseTaskContext(mode, contextArgs.batchId);
  const expectedTaskId = mode === "INBOUND" ? context.inboundOrder.id : context.outboundOrder.id;

  if (contextArgs.contractId !== context.contract.id) {
    throw new Error(mode === "INBOUND" ? "当前合同上下文不匹配，不能执行入库。" : "当前合同上下文不匹配，不能执行出库。");
  }

  if (contextArgs.taskId !== expectedTaskId) {
    throw new Error(mode === "INBOUND" ? "当前仓库任务不匹配，不能执行入库。" : "当前出库任务不匹配，不能执行出库。");
  }

  if (contextArgs.warehouseId !== context.warehouse.id) {
    throw new Error("当前仓库上下文不匹配，请刷新仓储页面后重试。");
  }

  const qrItem = await prisma.qrItem.findUnique({
    where: { qrCode },
    include: {
      batch: {
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true,
              customerName: true,
              supplierName: true
            }
          }
        }
      }
    }
  });

  if (!qrItem) {
    throw new Error("该二维码不存在，请检查是否扫错货物。");
  }

  if (qrItem.batchId !== context.batch.id) {
    throw new Error(mode === "INBOUND" ? "该货物不属于当前入库批次。" : "该货物不属于当前出库单。");
  }

  if (qrItem.contractId && qrItem.contractId !== context.contract.id) {
    throw new Error(mode === "INBOUND" ? "该货物不属于当前合同，不能入库。" : "该货物不属于当前合同，不能出库。");
  }

  if (mode === "INBOUND") {
    if (qrItem.status === QrItemStatus.IN_STOCK) {
      throw new Error("该货物已入库，不能重复入库。");
    }

    if (qrItem.status === QrItemStatus.OUTBOUND) {
      throw new Error("该货物已出库，不能入库。");
    }

    if (qrItem.status !== QrItemStatus.PENDING_INBOUND) {
      throw new Error(`该货物当前状态为${statusLabel(qrItem.status)}，不能执行入库。`);
    }
  }

  if (mode === "OUTBOUND") {
    const alreadyOutboundCount = await prisma.qrItem.count({
      where: {
        batchId: context.batch.id,
        status: QrItemStatus.OUTBOUND
      }
    });

    if (alreadyOutboundCount >= context.outboundOrder.quantity) {
      throw new Error("当前出库任务的应扫数量已完成，不能继续出库。");
    }

    if (qrItem.status === QrItemStatus.PENDING_INBOUND) {
      throw new Error("该货物尚未入库，不能出库。");
    }

    if (qrItem.status === QrItemStatus.OUTBOUND) {
      throw new Error("该货物已出库，不能重复出库。");
    }

    if (qrItem.status === QrItemStatus.FROZEN) {
      throw new Error("该货物已冻结，不能出库。");
    }

    if (qrItem.status === QrItemStatus.DAMAGED || qrItem.status === QrItemStatus.LOST) {
      throw new Error("该货物状态异常，不能出库。");
    }

    if (qrItem.status !== QrItemStatus.IN_STOCK) {
      throw new Error(`该货物当前状态为${statusLabel(qrItem.status)}，不能执行出库。`);
    }
  }

  const targetLocationId =
    normalizeText(contextArgs.locationId) ??
    context.suggestedLocation?.id ??
    null;

  return {
    context,
    qrItem,
    targetLocationId
  };
}

warehouseRouter.post("/scan/context", async (request, response) => {
  const payload = (request.body ?? {}) as WarehouseContextPayload;
  const mode = normalizeOperationType(payload.mode);

  if (!mode) {
    response.status(400).json({ message: "mode is required and must be INBOUND or OUTBOUND." });
    return;
  }

  try {
    const context = await buildWarehouseContext(mode, normalizeText(payload.batchId));
    response.json(context);
  } catch (error) {
    response.status(400).json({ message: toErrorMessage(error, "加载仓储任务上下文失败。") });
  }
});

warehouseRouter.get("/workbench", async (request, response) => {
  try {
    const workbench = await buildWarehouseWorkbench(normalizeText(request.query.batchId));
    response.json(workbench);
  } catch (error) {
    response.status(400).json({ message: toErrorMessage(error, "加载仓储工作台失败。") });
  }
});

warehouseRouter.post("/scan/preview", async (request, response) => {
  const payload = (request.body ?? {}) as ScanPreviewPayload;
  const mode = normalizeOperationType(payload.mode);
  const qrCode = normalizeText(payload.qrCode);
  const batchId = normalizeText(payload.batchId);
  const taskId = normalizeText(payload.taskId);
  const contractId = normalizeText(payload.contractId);
  const warehouseId = normalizeText(payload.warehouseId);

  if (!mode || !qrCode || !batchId || !taskId || !contractId || !warehouseId) {
    response.status(400).json({ message: "mode, qrCode, batchId, taskId, contractId and warehouseId are required." });
    return;
  }

  try {
    const { context, qrItem, targetLocationId } = await createWarehouseMutation(mode, qrCode, {
      batchId,
      taskId,
      contractId,
      warehouseId,
      locationId: normalizeText(payload.locationId)
    });

    const location =
      targetLocationId
        ? context.locations.find((item) => item.id === targetLocationId) ?? null
        : null;

    response.json({
      operationType: mode,
      qrItemId: qrItem.id,
      qrCode: qrItem.qrCode,
      productName: qrItem.productName ?? context.batch.productName,
      contractId: context.contract.id,
      contractNo: context.contract.contractNo,
      batchId: context.batch.id,
      batchNo: context.batch.batchNo,
      currentStatus: qrItem.status,
      currentStatusLabel: statusLabel(qrItem.status),
      warehouseId: context.warehouse.id,
      warehouseName: context.warehouse.name,
      locationId: location?.id ?? targetLocationId,
      locationCode: location?.locationCode ?? context.suggestedLocation?.locationCode ?? null,
      taskId,
      taskNo: mode === "INBOUND" ? context.preReceiveOrder.preReceiveNo : context.outboundOrder.outboundNo,
      orderNo: mode === "INBOUND" ? context.inboundOrder.inboundNo : context.outboundOrder.outboundNo,
      quantityContext: {
        target: mode === "INBOUND" ? context.inboundOrder.quantity : context.outboundOrder.quantity,
        unit: context.batch.unit
      },
      summary: {
        operatorStep: "校验通过，等待人工确认",
        message: mode === "INBOUND" ? "当前二维码允许执行扫码入库。" : "当前二维码允许执行扫码出库。"
      }
    });
  } catch (error) {
    response.status(400).json({ message: toErrorMessage(error, "扫码预检失败。") });
  }
});

warehouseRouter.post("/scan/confirm", async (request, response) => {
  const payload = (request.body ?? {}) as ConfirmScanPayload;
  const mode = normalizeOperationType(payload.mode);
  const qrItemId = normalizeText(payload.qrItemId);
  const batchId = normalizeText(payload.batchId);
  const taskId = normalizeText(payload.taskId);
  const contractId = normalizeText(payload.contractId);
  const warehouseId = normalizeText(payload.warehouseId);

  if (!mode || !qrItemId || !batchId || !taskId || !contractId || !warehouseId) {
    response.status(400).json({ message: "mode, qrItemId, batchId, taskId, contractId and warehouseId are required." });
    return;
  }

  try {
    const existingQrItem = await prisma.qrItem.findUnique({
      where: { id: qrItemId }
    });

    if (!existingQrItem) {
      response.status(404).json({ message: "QR item not found." });
      return;
    }

    const { context, qrItem, targetLocationId } = await createWarehouseMutation(mode, existingQrItem.qrCode, {
      batchId,
      taskId,
      contractId,
      warehouseId,
      locationId: normalizeText(payload.locationId)
    });

    const operator = await resolveOperator();
    const occurredAt = new Date();
    const nextStatus = mode === "INBOUND" ? QrItemStatus.IN_STOCK : QrItemStatus.OUTBOUND;
    const movementType = mode === "INBOUND" ? StockMovementType.INBOUND : StockMovementType.OUTBOUND;
    const note = mode === "INBOUND" ? "仓储扫码入库确认" : "仓储扫码出库确认";
    const remark = mode === "INBOUND" ? "扫码命中后人工确认入库" : "扫码命中后人工确认出库";

    const updatedQrItem = await prisma.$transaction(async (tx) => {
      const nextItem = await tx.qrItem.update({
        where: { id: qrItem.id },
        data:
          mode === "INBOUND"
            ? {
                status: nextStatus,
                inboundAt: occurredAt,
                currentWarehouse: context.warehouse.name,
                warehouseId: context.warehouse.id,
                locationId: targetLocationId
              }
            : {
                status: nextStatus,
                outboundAt: occurredAt
              }
      });

      await tx.stockMovement.create({
        data: {
          qrItemId: qrItem.id,
          batchId: context.batch.id,
          contractId: context.contract.id,
          skuId: qrItem.skuId ?? context.batch.skuId,
          movementType,
          fromStatus: qrItem.status,
          toStatus: nextStatus,
          warehouseName: context.warehouse.name,
          warehouseId: context.warehouse.id,
          locationId: targetLocationId,
          operatorId: operator?.id,
          operatorName: operator?.displayName ?? "Demo Owner",
          note,
          remark,
          occurredAt
        }
      });

      const pendingCount = await tx.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.PENDING_INBOUND
        }
      });
      const inStockCount = await tx.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.IN_STOCK
        }
      });
      const outboundCount = await tx.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.OUTBOUND
        }
      });

      let nextBatchStatus = context.batch.status;

      if (mode === "INBOUND") {
        nextBatchStatus = pendingCount === 0 ? BatchStatus.IN_STOCK : BatchStatus.READY_FOR_QR;
      } else if (outboundCount > 0) {
        nextBatchStatus = inStockCount === 0 && pendingCount === 0 ? BatchStatus.COMPLETED : BatchStatus.PARTIAL_OUTBOUND;
      }

      await tx.batch.update({
        where: { id: context.batch.id },
        data: {
          status: nextBatchStatus
        }
      });

      await tx.inboundOrder.update({
        where: { id: context.inboundOrder.id },
        data: {
          status:
            mode === "INBOUND"
              ? pendingCount === 0
                ? "COMPLETED"
                : "IN_PROGRESS"
              : context.inboundOrder.status
        }
      });

      await tx.preReceiveOrder.update({
        where: { id: context.preReceiveOrder.id },
        data: {
          status:
            mode === "INBOUND"
              ? pendingCount === 0
                ? "COMPLETED"
                : "IN_PROGRESS"
              : context.preReceiveOrder.status
        }
      });

      await tx.outboundOrder.update({
        where: { id: context.outboundOrder.id },
        data: {
          status:
            mode === "OUTBOUND"
              ? outboundCount >= context.outboundOrder.quantity
                ? "COMPLETED"
                : "IN_PROGRESS"
              : context.outboundOrder.status
        }
      });

      return nextItem;
    });

    response.json({
      success: true,
      message: mode === "INBOUND" ? "扫码入库成功。" : "扫码出库成功。",
      qrItem: {
        id: updatedQrItem.id,
        qrCode: updatedQrItem.qrCode,
        status: updatedQrItem.status,
        inboundAt: updatedQrItem.inboundAt,
        outboundAt: updatedQrItem.outboundAt
      },
      context: await buildWarehouseContext(mode, context.batch.id)
    });
  } catch (error) {
    response.status(400).json({ message: toErrorMessage(error, "确认扫码操作失败。") });
  }
});

warehouseRouter.post("/scan/bulk", async (request, response) => {
  const payload = (request.body ?? {}) as BulkScanPayload;
  const mode = normalizeOperationType(payload.mode);
  const batchId = normalizeText(payload.batchId);
  const taskId = normalizeText(payload.taskId);
  const contractId = normalizeText(payload.contractId);
  const warehouseId = normalizeText(payload.warehouseId);
  const quantity = ensurePositiveInteger(payload.quantity);

  if (!mode || !batchId || !taskId || !contractId || !warehouseId || !quantity) {
    response
      .status(400)
      .json({ message: "mode, batchId, taskId, contractId, warehouseId and positive integer quantity are required." });
    return;
  }

  try {
    const context = await ensureWarehouseTaskContext(mode, batchId);
    const candidateStatus = mode === "INBOUND" ? QrItemStatus.PENDING_INBOUND : QrItemStatus.IN_STOCK;
    const candidates = await prisma.qrItem.findMany({
      where: {
        batchId: context.batch.id,
        status: candidateStatus
      },
      orderBy: { serialNo: "asc" },
      take: quantity
    });

    if (candidates.length === 0) {
      throw new Error(mode === "INBOUND" ? "当前没有可批量入库的二维码。" : "当前没有可批量出库的二维码。");
    }

    const results = [];
    const failures: Array<{ qrCode: string; message: string }> = [];

    for (const item of candidates) {
      try {
        const { context: nextContext, qrItem, targetLocationId } = await createWarehouseMutation(mode, item.qrCode, {
          batchId,
          taskId,
          contractId,
          warehouseId,
          locationId: normalizeText(payload.locationId)
        });

        const operator = await resolveOperator();
        const occurredAt = new Date();
        const nextStatus = mode === "INBOUND" ? QrItemStatus.IN_STOCK : QrItemStatus.OUTBOUND;
        const movementType = mode === "INBOUND" ? StockMovementType.INBOUND : StockMovementType.OUTBOUND;

        await prisma.$transaction(async (tx) => {
          await tx.qrItem.update({
            where: { id: qrItem.id },
            data:
              mode === "INBOUND"
                ? {
                    status: nextStatus,
                    inboundAt: occurredAt,
                    currentWarehouse: nextContext.warehouse.name,
                    warehouseId: nextContext.warehouse.id,
                    locationId: targetLocationId
                  }
                : {
                    status: nextStatus,
                    outboundAt: occurredAt
                  }
          });

          await tx.stockMovement.create({
            data: {
              qrItemId: qrItem.id,
              batchId: nextContext.batch.id,
              contractId: nextContext.contract.id,
              skuId: qrItem.skuId ?? nextContext.batch.skuId,
              movementType,
              fromStatus: qrItem.status,
              toStatus: nextStatus,
              warehouseName: nextContext.warehouse.name,
              warehouseId: nextContext.warehouse.id,
              locationId: targetLocationId,
              operatorId: operator?.id,
              operatorName: operator?.displayName ?? "Demo Owner",
              note: mode === "INBOUND" ? "Demo 批量扫码入库" : "Demo 批量扫码出库",
              remark: "演示辅助批量执行",
              occurredAt
            }
          });
        });

        results.push({
          qrCode: qrItem.qrCode,
          status: nextStatus
        });
      } catch (error) {
        failures.push({
          qrCode: item.qrCode,
          message: toErrorMessage(error, "批量执行失败。")
        });
      }
    }

    if (mode === "INBOUND" || mode === "OUTBOUND") {
      const pendingCount = await prisma.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.PENDING_INBOUND
        }
      });
      const inStockCount = await prisma.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.IN_STOCK
        }
      });
      const outboundCount = await prisma.qrItem.count({
        where: {
          batchId: context.batch.id,
          status: QrItemStatus.OUTBOUND
        }
      });

      await prisma.batch.update({
        where: { id: context.batch.id },
        data: {
          status:
            mode === "INBOUND"
              ? pendingCount === 0
                ? BatchStatus.IN_STOCK
                : BatchStatus.READY_FOR_QR
              : inStockCount === 0 && pendingCount === 0
                ? BatchStatus.COMPLETED
                : outboundCount > 0
                  ? BatchStatus.PARTIAL_OUTBOUND
                  : context.batch.status
        }
      });

      if (mode === "INBOUND") {
        await prisma.inboundOrder.update({
          where: { id: context.inboundOrder.id },
          data: {
            status: pendingCount === 0 ? "COMPLETED" : "IN_PROGRESS"
          }
        });
        await prisma.preReceiveOrder.update({
          where: { id: context.preReceiveOrder.id },
          data: {
            status: pendingCount === 0 ? "COMPLETED" : "IN_PROGRESS"
          }
        });
      } else {
        await prisma.outboundOrder.update({
          where: { id: context.outboundOrder.id },
          data: {
            status: outboundCount >= context.outboundOrder.quantity ? "COMPLETED" : "IN_PROGRESS"
          }
        });
      }
    }

    response.json({
      success: true,
      processed: results.length,
      requested: quantity,
      failures,
      items: results,
      context: await buildWarehouseContext(mode, batchId)
    });
  } catch (error) {
    response.status(400).json({ message: toErrorMessage(error, "批量扫码辅助执行失败。") });
  }
});
