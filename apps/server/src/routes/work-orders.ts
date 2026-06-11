import { Router } from "express";
import { prisma } from "../lib/prisma";

type Tone = "default" | "processing" | "success" | "warning" | "error";

type WorkOrderRecord = {
  id: string;
  workOrderNo: string;
  type: string;
  title: string;
  content: string | null;
  responsibleDepartment: string | null;
  responsiblePerson: string | null;
  status: string;
  priority: string;
  startTime: Date | null;
  dueTime: Date | null;
  contractId: string | null;
  batchId: string | null;
  documentId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  completionCondition: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WorkOrderContext = {
  contractById: Map<
    string,
    {
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
      status: string;
      paymentStatus: string;
    }
  >;
  batchById: Map<
    string,
    {
      id: string;
      batchNo: string;
      productName: string;
      totalQuantity: number;
      unit: string;
      status: string;
      destinationWarehouse: string;
      warehouseId: string | null;
    }
  >;
  documentById: Map<
    string,
    {
      id: string;
      documentType: string;
      originalName: string | null;
      fileName: string;
      status: string;
      aiStatus: string;
      businessCreated: boolean;
      createdAt: Date;
      updatedAt: Date;
    }
  >;
  purchaseOrderById: Map<
    string,
    {
      id: string;
      purchaseNo: string;
      supplierName: string;
      skuName: string;
      quantity: number;
      unit: string;
      status: string;
      deliveryDate: Date | null;
    }
  >;
  shipmentById: Map<
    string,
    {
      id: string;
      shipmentNo: string;
      shippingCompany: string | null;
      billOfLadingNo: string | null;
      containerNo: string | null;
      originPort: string | null;
      destinationPort: string | null;
      departureTime: Date | null;
      estimatedArrivalTime: Date | null;
      actualArrivalTime: Date | null;
      status: string;
    }
  >;
  customsById: Map<
    string,
    {
      id: string;
      clearanceNo: string;
      responsibleCompany: string | null;
      responsiblePerson: string | null;
      packingListDocumentId: string | null;
      invoiceDocumentId: string | null;
      billOfLadingDocumentId: string | null;
      certificateDocumentId: string | null;
      status: string;
    }
  >;
  preReceiveById: Map<
    string,
    {
      id: string;
      preReceiveNo: string;
      warehouseId: string | null;
      expectedArrivalTime: Date | null;
      skuName: string;
      quantity: number;
      unit: string;
      suggestedLocation: string | null;
      status: string;
    }
  >;
  inboundById: Map<
    string,
    {
      id: string;
      inboundNo: string;
      warehouseId: string | null;
      quantity: number;
      unit: string;
      status: string;
    }
  >;
  outboundById: Map<
    string,
    {
      id: string;
      outboundNo: string;
      salesOrderId: string | null;
      warehouseId: string | null;
      quantity: number;
      unit: string;
      status: string;
    }
  >;
  salesOrderById: Map<
    string,
    {
      id: string;
      salesNo: string;
      customerName: string;
      skuName: string;
      quantity: number;
      unit: string;
      amount: number;
      currency: string;
      deliveryMethod: string | null;
      deliveryStatus: string;
      signStatus: string;
      status: string;
    }
  >;
  deliveryOrderById: Map<
    string,
    {
      id: string;
      deliveryNo: string;
      warehouseName: string | null;
      quantity: number;
      unit: string;
      status: string;
    }
  >;
  receivableById: Map<
    string,
    {
      id: string;
      contractId: string | null;
      salesOrderId: string | null;
      amount: number;
      currency: string;
      dueDate: Date | null;
      receivedAmount: number;
      status: string;
    }
  >;
  paymentByContractId: Map<
    string,
    {
      id: string;
      receivableAmount: number;
      receivedAmount: number;
      currency: string;
      status: string;
      dueDate: Date | null;
      receivedAt: Date | null;
      paidAt: Date | null;
    }
  >;
  qrSummaryByBatchId: Map<
    string,
    {
      total: number;
      pendingInbound: number;
      inStock: number;
      outbound: number;
      frozen: number;
      damaged: number;
      lost: number;
    }
  >;
};

type WorkOrderTypeMeta = {
  code: string;
  label: string;
  moduleLabel: string;
  moduleRoute: string;
  color: Tone;
  description: string;
  attachmentRequirements: string[];
  executionChecklist: string[];
};

const workOrderTypeCatalog: Record<string, Omit<WorkOrderTypeMeta, "code">> = {
  SUPPLIER_DELIVERY_FOLLOW_UP: {
    label: "供应商发货跟进",
    moduleLabel: "采购与集货",
    moduleRoute: "/procurement",
    color: "processing",
    description: "用于确认供应商发货、国内集货和后续交接国际物流。",
    attachmentRequirements: ["采购单", "供应商交期确认记录", "发货或送货凭证（如有）"],
    executionChecklist: ["核对供应商交期与发货数量", "确认国内集货计划", "完成后交接国际物流模块"]
  },
  LOGISTICS_ARRANGEMENT: {
    label: "国际运输安排",
    moduleLabel: "国际物流",
    moduleRoute: "/logistics",
    color: "processing",
    description: "用于安排起运、提单、柜号和海运节点推进。",
    attachmentRequirements: ["采购/集货完成信息", "提单信息", "柜号与船公司计划"],
    executionChecklist: ["确认运输批次与起运港", "补齐提单/柜号", "推进到离港或到港节点"]
  },
  CUSTOMS_CLEARANCE: {
    label: "清关执行",
    moduleLabel: "报关清关",
    moduleRoute: "/customs",
    color: "warning",
    description: "用于承接到港后的清关单据核对、责任分派和清关完成闭环。",
    attachmentRequirements: ["箱单", "发票", "提单", "产地证（如有）"],
    executionChecklist: ["核对单据一致性", "分派责任公司与责任人", "完成清关并交接境外陆运/仓库预收货"]
  },
  OVERSEAS_LAND_TRANSPORT: {
    label: "境外陆运任务",
    moduleLabel: "报关清关",
    moduleRoute: "/customs",
    color: "processing",
    description: "用于清关完成后安排货物从目的港转运至目标仓库。",
    attachmentRequirements: ["清关完成信息", "派车/提货安排", "目标仓库收货信息"],
    executionChecklist: ["确认派车与承运信息", "通知目标仓库", "转运完成后交接仓储收货"]
  },
  WAREHOUSE_PRE_RECEIVE: {
    label: "仓库预收货",
    moduleLabel: "仓储管理",
    moduleRoute: "/warehouse",
    color: "success",
    description: "用于仓库提前准备收货、库位与扫码验收。",
    attachmentRequirements: ["预收货单", "箱单", "建议库位信息", "扫码收货任务"],
    executionChecklist: ["确认预计到仓时间", "准备建议库位", "执行扫码收货验收"]
  },
  WAREHOUSE_OUTBOUND_PICKING: {
    label: "仓库出库工单",
    moduleLabel: "仓储管理",
    moduleRoute: "/warehouse",
    color: "processing",
    description: "用于承接销售单后的拣货、扫码出库与交接配送。",
    attachmentRequirements: ["销售单", "出库单", "客户配送要求"],
    executionChecklist: ["核对销售单与批次", "执行扫码出库", "交接配送或提货"]
  },
  RECEIVABLE_FOLLOW_UP: {
    label: "财务回款跟进",
    moduleLabel: "财务回款",
    moduleRoute: "/finance",
    color: "warning",
    description: "用于跟进客户回款、核销与逾期预警。",
    attachmentRequirements: ["销售签收信息", "应收记录", "回款计划或对账信息"],
    executionChecklist: ["确认账期与应收余额", "跟进部分/全部回款", "达到条件后进入可核销状态"]
  },
  OVERDUE_COLLECTION_ESCALATION: {
    label: "逾期催收升级",
    moduleLabel: "财务回款",
    moduleRoute: "/finance",
    color: "error",
    description: "用于对已逾期的应收发起强提醒和催收升级。",
    attachmentRequirements: ["应收记录", "逾期说明", "催收跟进纪要"],
    executionChecklist: ["确认逾期天数与责任人", "补充催收记录", "同步上级督办结论"]
  }
};

export const workOrdersRouter = Router();

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function formatDocumentType(documentType: string) {
  switch (documentType) {
    case "CONTRACT":
      return "合同";
    case "PACKING_LIST":
      return "箱单";
    case "BILL_OF_LADING":
      return "提单";
    case "INVOICE":
      return "发票";
    default:
      return "其他单据";
  }
}

function humanizeWorkOrderType(type: string) {
  return type
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
}

function resolveWorkOrderTypeMeta(type: string): WorkOrderTypeMeta {
  const found = workOrderTypeCatalog[type];

  if (found) {
    return {
      code: type,
      ...found
    };
  }

  return {
    code: type,
    label: humanizeWorkOrderType(type),
    moduleLabel: "自动工单",
    moduleRoute: "/work-orders",
    color: "default",
    description: "当前工单类型尚未配置专门说明，先按通用任务进行展示。",
    attachmentRequirements: ["关联系统单据"],
    executionChecklist: ["确认任务归属", "补充上下文信息", "完成后更新闭环状态"]
  };
}

function resolveStatusMeta(status: string) {
  switch (status) {
    case "COMPLETED":
      return {
        code: status,
        label: "已完成",
        color: "success" as const,
        isClosed: true
      };
    case "IN_PROGRESS":
      return {
        code: status,
        label: "处理中",
        color: "processing" as const,
        isClosed: false
      };
    case "BLOCKED":
      return {
        code: status,
        label: "已阻塞",
        color: "error" as const,
        isClosed: false
      };
    case "CANCELLED":
      return {
        code: status,
        label: "已取消",
        color: "default" as const,
        isClosed: true
      };
    case "PENDING":
    default:
      return {
        code: status,
        label: "待办",
        color: "warning" as const,
        isClosed: false
      };
  }
}

function resolvePriorityMeta(priority: string) {
  switch (priority) {
    case "URGENT":
      return {
        code: priority,
        label: "紧急",
        color: "error" as const,
        rank: 0
      };
    case "HIGH":
      return {
        code: priority,
        label: "高",
        color: "error" as const,
        rank: 1
      };
    case "LOW":
      return {
        code: priority,
        label: "低",
        color: "default" as const,
        rank: 3
      };
    case "NORMAL":
    default:
      return {
        code: priority,
        label: "普通",
        color: "processing" as const,
        rank: 2
      };
  }
}

function resolveReminderMeta(dueTime: Date | null, status: string, now = new Date()) {
  const statusMeta = resolveStatusMeta(status);

  if (statusMeta.isClosed) {
    return {
      code: "CLOSED",
      label: "已闭环",
      color: "success" as const,
      isOverdue: false,
      daysOverdue: 0,
      daysUntilDue: 0,
      rank: 5
    };
  }

  if (!dueTime) {
    return {
      code: "NO_DUE_DATE",
      label: "未设截止时间",
      color: "default" as const,
      isOverdue: false,
      daysOverdue: 0,
      daysUntilDue: null as number | null,
      rank: 4
    };
  }

  const diffMs = dueTime.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return {
      code: "OVERDUE",
      label: `已逾期 ${Math.abs(diffDays)} 天`,
      color: "error" as const,
      isOverdue: true,
      daysOverdue: Math.abs(diffDays),
      daysUntilDue: diffDays,
      rank: 0
    };
  }

  if (diffDays === 0) {
    return {
      code: "DUE_TODAY",
      label: "今日到期",
      color: "warning" as const,
      isOverdue: false,
      daysOverdue: 0,
      daysUntilDue: 0,
      rank: 1
    };
  }

  if (diffDays <= 3) {
    return {
      code: "DUE_SOON",
      label: `即将到期，剩余 ${diffDays} 天`,
      color: "warning" as const,
      isOverdue: false,
      daysOverdue: 0,
      daysUntilDue: diffDays,
      rank: 2
    };
  }

  return {
    code: "IN_TERM",
    label: `账期内，剩余 ${diffDays} 天`,
    color: "processing" as const,
    isOverdue: false,
    daysOverdue: 0,
    daysUntilDue: diffDays,
    rank: 3
  };
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("zh-CN")} ${currency}`.trim();
}

function formatQuantity(quantity: number, unit: string) {
  return `${quantity.toLocaleString("zh-CN")}${unit}`;
}

async function loadWorkOrderContext(workOrders: WorkOrderRecord[]): Promise<WorkOrderContext> {
  const contractIds = uniqueIds(workOrders.map((item) => item.contractId));
  const batchIds = uniqueIds(workOrders.map((item) => item.batchId));
  const purchaseOrderIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "PurchaseOrder")
      .map((item) => item.relatedEntityId)
  );
  const shipmentIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "Shipment")
      .map((item) => item.relatedEntityId)
  );
  const customsIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "CustomsClearance")
      .map((item) => item.relatedEntityId)
  );
  const preReceiveIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "PreReceiveOrder")
      .map((item) => item.relatedEntityId)
  );
  const inboundIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "InboundOrder")
      .map((item) => item.relatedEntityId)
  );
  const outboundIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "OutboundOrder")
      .map((item) => item.relatedEntityId)
  );
  const salesOrderIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "SalesOrder")
      .map((item) => item.relatedEntityId)
  );
  const deliveryOrderIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "DeliveryOrder")
      .map((item) => item.relatedEntityId)
  );
  const receivableIds = uniqueIds(
    workOrders
      .filter((item) => item.relatedEntityType === "Receivable")
      .map((item) => item.relatedEntityId)
  );

  const [
    contracts,
    batches,
    purchaseOrders,
    shipments,
    customsClearances,
    preReceiveOrders,
    inboundOrders,
    outboundOrders,
    salesOrders,
    deliveryOrders,
    receivables,
    payments,
    qrItems
  ] = await Promise.all([
    contractIds.length > 0
      ? prisma.contract.findMany({
          where: { id: { in: contractIds } },
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            amount: true,
            currency: true,
            destinationWarehouse: true,
            status: true,
            paymentStatus: true
          }
        })
      : Promise.resolve([]),
    batchIds.length > 0
      ? prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: {
            id: true,
            batchNo: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true,
            warehouseId: true
          }
        })
      : Promise.resolve([]),
    purchaseOrderIds.length > 0
      ? prisma.purchaseOrder.findMany({
          where: { id: { in: purchaseOrderIds } },
          select: {
            id: true,
            purchaseNo: true,
            supplierName: true,
            skuName: true,
            quantity: true,
            unit: true,
            status: true,
            deliveryDate: true
          }
        })
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: {
            id: true,
            shipmentNo: true,
            shippingCompany: true,
            billOfLadingNo: true,
            containerNo: true,
            originPort: true,
            destinationPort: true,
            departureTime: true,
            estimatedArrivalTime: true,
            actualArrivalTime: true,
            status: true
          }
        })
      : Promise.resolve([]),
    customsIds.length > 0
      ? prisma.customsClearance.findMany({
          where: { id: { in: customsIds } },
          select: {
            id: true,
            clearanceNo: true,
            responsibleCompany: true,
            responsiblePerson: true,
            packingListDocumentId: true,
            invoiceDocumentId: true,
            billOfLadingDocumentId: true,
            certificateDocumentId: true,
            status: true
          }
        })
      : Promise.resolve([]),
    preReceiveIds.length > 0
      ? prisma.preReceiveOrder.findMany({
          where: { id: { in: preReceiveIds } },
          select: {
            id: true,
            preReceiveNo: true,
            warehouseId: true,
            expectedArrivalTime: true,
            skuName: true,
            quantity: true,
            unit: true,
            suggestedLocation: true,
            status: true
          }
        })
      : Promise.resolve([]),
    inboundIds.length > 0
      ? prisma.inboundOrder.findMany({
          where: { id: { in: inboundIds } },
          select: {
            id: true,
            inboundNo: true,
            warehouseId: true,
            quantity: true,
            unit: true,
            status: true
          }
        })
      : Promise.resolve([]),
    outboundIds.length > 0
      ? prisma.outboundOrder.findMany({
          where: { id: { in: outboundIds } },
          select: {
            id: true,
            outboundNo: true,
            salesOrderId: true,
            warehouseId: true,
            quantity: true,
            unit: true,
            status: true
          }
        })
      : Promise.resolve([]),
    salesOrderIds.length > 0
      ? prisma.salesOrder.findMany({
          where: { id: { in: salesOrderIds } },
          select: {
            id: true,
            salesNo: true,
            customerName: true,
            skuName: true,
            quantity: true,
            unit: true,
            amount: true,
            currency: true,
            deliveryMethod: true,
            deliveryStatus: true,
            signStatus: true,
            status: true
          }
        })
      : Promise.resolve([]),
    deliveryOrderIds.length > 0
      ? prisma.deliveryOrder.findMany({
          where: { id: { in: deliveryOrderIds } },
          select: {
            id: true,
            deliveryNo: true,
            warehouseName: true,
            quantity: true,
            unit: true,
            status: true
          }
        })
      : Promise.resolve([]),
    receivableIds.length > 0
      ? prisma.receivable.findMany({
          where: { id: { in: receivableIds } },
          select: {
            id: true,
            contractId: true,
            salesOrderId: true,
            amount: true,
            currency: true,
            dueDate: true,
            receivedAmount: true,
            status: true
          }
        })
      : Promise.resolve([]),
    contractIds.length > 0
      ? prisma.payment.findMany({
          where: { contractId: { in: contractIds } },
          select: {
            id: true,
            contractId: true,
            receivableAmount: true,
            receivedAmount: true,
            currency: true,
            status: true,
            dueDate: true,
            receivedAt: true,
            paidAt: true
          }
        })
      : Promise.resolve([]),
    batchIds.length > 0
      ? prisma.qrItem.findMany({
          where: { batchId: { in: batchIds } },
          select: {
            batchId: true,
            status: true
          }
        })
      : Promise.resolve([])
  ]);

  const allDocumentIds = uniqueIds([
    ...workOrders.map((item) => item.documentId),
    ...customsClearances.flatMap((item) => [
      item.packingListDocumentId,
      item.invoiceDocumentId,
      item.billOfLadingDocumentId,
      item.certificateDocumentId
    ])
  ]);

  const documents =
    allDocumentIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: allDocumentIds } },
          select: {
            id: true,
            documentType: true,
            originalName: true,
            fileName: true,
            status: true,
            aiStatus: true,
            businessCreated: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : [];

  const qrSummaryByBatchId = new Map<
    string,
    {
      total: number;
      pendingInbound: number;
      inStock: number;
      outbound: number;
      frozen: number;
      damaged: number;
      lost: number;
    }
  >();

  for (const item of qrItems) {
    const summary =
      qrSummaryByBatchId.get(item.batchId) ?? {
        total: 0,
        pendingInbound: 0,
        inStock: 0,
        outbound: 0,
        frozen: 0,
        damaged: 0,
        lost: 0
      };

    summary.total += 1;

    switch (item.status) {
      case "PENDING_INBOUND":
        summary.pendingInbound += 1;
        break;
      case "IN_STOCK":
        summary.inStock += 1;
        break;
      case "OUTBOUND":
        summary.outbound += 1;
        break;
      case "FROZEN":
        summary.frozen += 1;
        break;
      case "DAMAGED":
        summary.damaged += 1;
        break;
      case "LOST":
        summary.lost += 1;
        break;
      default:
        break;
    }

    qrSummaryByBatchId.set(item.batchId, summary);
  }

  return {
    contractById: new Map(contracts.map((item) => [item.id, item])),
    batchById: new Map(batches.map((item) => [item.id, item])),
    documentById: new Map(documents.map((item) => [item.id, item])),
    purchaseOrderById: new Map(purchaseOrders.map((item) => [item.id, item])),
    shipmentById: new Map(shipments.map((item) => [item.id, item])),
    customsById: new Map(customsClearances.map((item) => [item.id, item])),
    preReceiveById: new Map(preReceiveOrders.map((item) => [item.id, item])),
    inboundById: new Map(inboundOrders.map((item) => [item.id, item])),
    outboundById: new Map(outboundOrders.map((item) => [item.id, item])),
    salesOrderById: new Map(salesOrders.map((item) => [item.id, item])),
    deliveryOrderById: new Map(deliveryOrders.map((item) => [item.id, item])),
    receivableById: new Map(receivables.map((item) => [item.id, item])),
    paymentByContractId: new Map(payments.map((item) => [item.contractId, item])),
    qrSummaryByBatchId
  };
}

function buildRelatedEntitySummary(workOrder: WorkOrderRecord, context: WorkOrderContext) {
  const { relatedEntityType, relatedEntityId } = workOrder;

  if (!relatedEntityType || !relatedEntityId) {
    return null;
  }

  if (relatedEntityType === "PurchaseOrder") {
    const entity = context.purchaseOrderById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "采购单",
      recordNo: entity.purchaseNo,
      status: entity.status,
      summary: `${entity.supplierName} / ${entity.skuName} / ${formatQuantity(entity.quantity, entity.unit)}`
    };
  }

  if (relatedEntityType === "Shipment") {
    const entity = context.shipmentById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "运输批次",
      recordNo: entity.shipmentNo,
      status: entity.status,
      summary: `${entity.originPort ?? "待定起运港"} -> ${entity.destinationPort ?? "待定目的港"}`
    };
  }

  if (relatedEntityType === "CustomsClearance") {
    const entity = context.customsById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "清关任务",
      recordNo: entity.clearanceNo,
      status: entity.status,
      summary: `${entity.responsibleCompany ?? "待定责任公司"} / ${entity.responsiblePerson ?? "待分派责任人"}`
    };
  }

  if (relatedEntityType === "PreReceiveOrder") {
    const entity = context.preReceiveById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "预收货单",
      recordNo: entity.preReceiveNo,
      status: entity.status,
      summary: `${entity.skuName} / ${formatQuantity(entity.quantity, entity.unit)}`
    };
  }

  if (relatedEntityType === "InboundOrder") {
    const entity = context.inboundById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "入库单",
      recordNo: entity.inboundNo,
      status: entity.status,
      summary: formatQuantity(entity.quantity, entity.unit)
    };
  }

  if (relatedEntityType === "OutboundOrder") {
    const entity = context.outboundById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "出库单",
      recordNo: entity.outboundNo,
      status: entity.status,
      summary: formatQuantity(entity.quantity, entity.unit)
    };
  }

  if (relatedEntityType === "SalesOrder") {
    const entity = context.salesOrderById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "销售单",
      recordNo: entity.salesNo,
      status: entity.status,
      summary: `${entity.customerName} / ${formatQuantity(entity.quantity, entity.unit)} / ${formatMoney(entity.amount, entity.currency)}`
    };
  }

  if (relatedEntityType === "DeliveryOrder") {
    const entity = context.deliveryOrderById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "配送单",
      recordNo: entity.deliveryNo,
      status: entity.status,
      summary: `${entity.warehouseName ?? "待定仓库"} / ${formatQuantity(entity.quantity, entity.unit)}`
    };
  }

  if (relatedEntityType === "Receivable") {
    const entity = context.receivableById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    const salesOrder = entity.salesOrderId ? context.salesOrderById.get(entity.salesOrderId) ?? null : null;
    const contract = entity.contractId ? context.contractById.get(entity.contractId) ?? null : null;

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "应收记录",
      recordNo:
        salesOrder?.salesNo ?? contract?.contractNo ?? `REC-${entity.id.slice(-8).toUpperCase()}`,
      status: entity.status,
      summary: `${formatMoney(entity.amount, entity.currency)} / 已收 ${formatMoney(entity.receivedAmount, entity.currency)}`
    };
  }

  if (relatedEntityType === "Document") {
    const entity = context.documentById.get(relatedEntityId);
    if (!entity) {
      return null;
    }

    return {
      entityType: relatedEntityType,
      entityId: entity.id,
      label: "单据",
      recordNo: entity.originalName ?? entity.fileName,
      status: entity.status,
      summary: formatDocumentType(entity.documentType)
    };
  }

  return {
    entityType: relatedEntityType,
    entityId: relatedEntityId,
    label: "关联业务实体",
    recordNo: relatedEntityId,
    status: "UNKNOWN",
    summary: `当前工单关联 ${relatedEntityType}，后续可补充更细的展示规则。`
  };
}

function buildLinkedDocuments(workOrder: WorkOrderRecord, context: WorkOrderContext) {
  const results: Array<{
    id: string;
    roleLabel: string;
    documentType: string;
    originalName: string | null;
    fileName: string;
    status: string;
    aiStatus: string;
    businessCreated: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];

  const seen = new Set<string>();

  const pushDocument = (documentId: string | null | undefined, roleLabel: string) => {
    if (!documentId || seen.has(documentId)) {
      return;
    }

    const document = context.documentById.get(documentId);
    if (!document) {
      return;
    }

    seen.add(documentId);
    results.push({
      id: document.id,
      roleLabel,
      documentType: document.documentType,
      originalName: document.originalName,
      fileName: document.fileName,
      status: document.status,
      aiStatus: document.aiStatus,
      businessCreated: document.businessCreated,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString()
    });
  };

  pushDocument(workOrder.documentId, "工单主单据");

  if (workOrder.relatedEntityType === "CustomsClearance" && workOrder.relatedEntityId) {
    const customs = context.customsById.get(workOrder.relatedEntityId);
    if (customs) {
      pushDocument(customs.packingListDocumentId, "清关箱单");
      pushDocument(customs.invoiceDocumentId, "清关发票");
      pushDocument(customs.billOfLadingDocumentId, "清关提单");
      pushDocument(customs.certificateDocumentId, "产地证");
    }
  }

  return results;
}

function buildAiSummary(workOrder: WorkOrderRecord, context: WorkOrderContext) {
  const typeMeta = resolveWorkOrderTypeMeta(workOrder.type);
  const statusMeta = resolveStatusMeta(workOrder.status);
  const reminderMeta = resolveReminderMeta(workOrder.dueTime, workOrder.status);
  const contract = workOrder.contractId ? context.contractById.get(workOrder.contractId) ?? null : null;
  const batch = workOrder.batchId ? context.batchById.get(workOrder.batchId) ?? null : null;
  const relatedEntity = buildRelatedEntitySummary(workOrder, context);
  const batchSummary = batch ? context.qrSummaryByBatchId.get(batch.id) ?? null : null;

  let summary = `工单 ${workOrder.workOrderNo} 当前处于“${statusMeta.label}”，归属 ${typeMeta.moduleLabel}。`;
  let nextAction = "进入详情核对责任人、完成条件与关联合同后，再推进下一步。";
  let risk = reminderMeta.isOverdue
    ? "该工单已经逾期，建议优先处理并同步上级督办。"
    : "若上下游节点未及时更新，可能导致后续模块状态滞后。";

  switch (workOrder.type) {
    case "SUPPLIER_DELIVERY_FOLLOW_UP":
      summary = `系统已为 ${contract?.contractNo ?? "当前合同"} 创建供应商发货跟进工单，用于确认采购执行、供应商发货与国内集货是否按计划完成。`;
      nextAction = reminderMeta.isOverdue
        ? "立即联系供应商确认发货与交期，并补充集货进度。"
        : "核对供应商交期和发货数量，必要时更新采购模块状态。";
      risk = "如果采购与集货信息滞后，国际物流无法按时建单。";
      break;
    case "LOGISTICS_ARRANGEMENT":
      summary = `系统已将 ${relatedEntity?.recordNo ?? "运输批次"} 纳入国际运输安排，需继续补齐提单、柜号和离港/到港节点。`;
      nextAction = reminderMeta.isOverdue
        ? "优先补齐提单与离港信息，并确认是否需要触发清关准备。"
        : "在物流页推进运输状态，并核对起运港、目的港与预计到港时间。";
      risk = "物流节点滞后会直接影响清关和仓储预收货节奏。";
      break;
    case "CUSTOMS_CLEARANCE":
      summary = `系统已为 ${relatedEntity?.recordNo ?? "清关任务"} 创建清关工单，当前需要核对清关单据、责任公司与责任人。`;
      nextAction = reminderMeta.isOverdue
        ? "优先核对箱单、发票、提单是否一致，并尽快推进清关完成。"
        : "在清关页检查 AI 单据一致性结果，并确认责任分派。";
      risk = "清关延误会阻塞境外陆运和仓库收货。";
      break;
    case "OVERSEAS_LAND_TRANSPORT":
      summary = `清关完成后，系统自动生成了境外陆运任务，负责把货物从目的港转运到目标仓库。`;
      nextAction = reminderMeta.isOverdue
        ? "尽快确认派车、司机或承运人安排，避免仓库收货延迟。"
        : "确认目的仓库和预计到仓时间，并同步仓储预收货。";
      risk = "陆运安排不及时会导致预收货任务空转。";
      break;
    case "WAREHOUSE_PRE_RECEIVE":
      summary = `系统已创建仓库预收货工单，当前需要在仓储模块准备库位并执行扫码收货。`;
      nextAction = reminderMeta.isOverdue
        ? "优先确认到仓时间与库位，准备扫码入库任务。"
        : "核对预收货单、建议库位和目标仓库，再安排扫码验收。";
      risk = "预收货未准备好会造成实际到仓后无法顺畅收货。";
      break;
    case "WAREHOUSE_OUTBOUND_PICKING":
      summary = `当前工单用于承接销售单后的仓库出库与拣货操作，扫码出库前需要再次校验批次和任务上下文。`;
      nextAction = "进入仓储管理页，核对销售单、出库单和二维码状态后再执行出库。";
      risk = "错误出库会直接影响库存准确性与后续配送。";
      break;
    case "RECEIVABLE_FOLLOW_UP": {
      const receivable =
        workOrder.relatedEntityType === "Receivable" && workOrder.relatedEntityId
          ? context.receivableById.get(workOrder.relatedEntityId) ?? null
          : null;
      summary = `系统正在跟进 ${relatedEntity?.recordNo ?? contract?.contractNo ?? "当前合同"} 的回款，当前应收 ${
        receivable ? formatMoney(receivable.amount, receivable.currency) : "待确认"
      }。`;
      nextAction = reminderMeta.isOverdue
        ? "优先联系客户确认回款计划，并在财务回款模块登记最新结果。"
        : "核对应收、已收和账期状态，必要时模拟部分或全部回款。";
      risk = "回款滞后会影响合同核销与利润兑现。";
      break;
    }
    default:
      if (relatedEntity?.recordNo) {
        summary = `${typeMeta.label} 已关联 ${relatedEntity.label} ${relatedEntity.recordNo}，可以继续在 ${typeMeta.moduleLabel} 模块推进。`;
      }
      break;
  }

  if (batchSummary && !resolveStatusMeta(workOrder.status).isClosed) {
    summary += ` 当前批次二维码状态：总 ${batchSummary.total}，在库 ${batchSummary.inStock}，已出库 ${batchSummary.outbound}。`;
  }

  return {
    title: `AI 模板说明：${typeMeta.label}`,
    summary,
    nextAction,
    risk
  };
}

function buildModuleNarrative(type: string) {
  const typeMeta = resolveWorkOrderTypeMeta(type);

  return {
    role: `${typeMeta.moduleLabel} 工单用于把业务节点从“状态描述”变成“责任到人、可追踪、可提醒”的执行任务。`,
    boundary:
      "第一版先做统一工单中心与模板化提醒，不做复杂审批流、多人会签、真实通知中心或流程引擎。"
  };
}

function buildAuditSummary(action: string) {
  switch (action) {
    case "PROCUREMENT_STATUS_UPDATE":
      return "采购状态已推进。";
    case "PROCUREMENT_HANDOFF_LOGISTICS":
      return "国内集货完成，系统已联动国际物流记录与运输安排工单。";
    case "LOGISTICS_STATUS_UPDATE":
      return "国际物流状态已推进。";
    case "LOGISTICS_TRIGGER_CUSTOMS":
      return "货物到达目的港后，系统已联动生成清关草稿与清关工单。";
    case "SALES_DELIVERY_COMPLETED":
      return "销售配送已完成。";
    case "SALES_TRIGGER_FINANCE":
      return "系统已将销售结果交接给财务回款跟进。";
    case "FINANCE_RECEIVABLE_PARTIAL":
      return "已登记部分回款，工单继续保持跟进。";
    case "FINANCE_RECEIVABLE_PAID":
      return "已登记全部回款，达到可核销条件。";
    case "DOCUMENT_DELETE":
      return "关联系统单据发生了删除动作。";
    default:
      return "系统已记录一次业务留痕。";
  }
}

function buildWorkOrderView(workOrder: WorkOrderRecord, context: WorkOrderContext) {
  const typeMeta = resolveWorkOrderTypeMeta(workOrder.type);
  const statusMeta = resolveStatusMeta(workOrder.status);
  const priorityMeta = resolvePriorityMeta(workOrder.priority);
  const reminderMeta = resolveReminderMeta(workOrder.dueTime, workOrder.status);
  const contract = workOrder.contractId ? context.contractById.get(workOrder.contractId) ?? null : null;
  const batch = workOrder.batchId ? context.batchById.get(workOrder.batchId) ?? null : null;
  const mainDocument = workOrder.documentId ? context.documentById.get(workOrder.documentId) ?? null : null;
  const relatedEntity = buildRelatedEntitySummary(workOrder, context);
  const linkedDocuments = buildLinkedDocuments(workOrder, context);
  const payment =
    workOrder.contractId ? context.paymentByContractId.get(workOrder.contractId) ?? null : null;
  const receivable =
    workOrder.relatedEntityType === "Receivable" && workOrder.relatedEntityId
      ? context.receivableById.get(workOrder.relatedEntityId) ?? null
      : null;

  return {
    id: workOrder.id,
    workOrderNo: workOrder.workOrderNo,
    type: workOrder.type,
    typeMeta,
    title: workOrder.title,
    content: workOrder.content,
    status: workOrder.status,
    statusMeta,
    priority: workOrder.priority,
    priorityMeta,
    reminderMeta,
    responsibleDepartment: workOrder.responsibleDepartment,
    responsiblePerson: workOrder.responsiblePerson,
    startTime: workOrder.startTime?.toISOString() ?? null,
    dueTime: workOrder.dueTime?.toISOString() ?? null,
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
    completionCondition: workOrder.completionCondition,
    aiSummary: buildAiSummary(workOrder, context),
    contract: contract
      ? {
          id: contract.id,
          contractNo: contract.contractNo,
          customerName: contract.customerName,
          supplierName: contract.supplierName,
          productName: contract.productName,
          totalQuantity: contract.totalQuantity,
          unit: contract.unit,
          amount: contract.amount,
          currency: contract.currency,
          destinationWarehouse: contract.destinationWarehouse,
          status: contract.status,
          paymentStatus: contract.paymentStatus
        }
      : null,
    batch: batch
      ? {
          id: batch.id,
          batchNo: batch.batchNo,
          productName: batch.productName,
          totalQuantity: batch.totalQuantity,
          unit: batch.unit,
          status: batch.status,
          destinationWarehouse: batch.destinationWarehouse,
          qrSummary:
            context.qrSummaryByBatchId.get(batch.id) ?? {
              total: 0,
              pendingInbound: 0,
              inStock: 0,
              outbound: 0,
              frozen: 0,
              damaged: 0,
              lost: 0
            }
        }
      : null,
    mainDocument: mainDocument
      ? {
          id: mainDocument.id,
          documentType: mainDocument.documentType,
          documentTypeLabel: formatDocumentType(mainDocument.documentType),
          originalName: mainDocument.originalName,
          fileName: mainDocument.fileName,
          status: mainDocument.status,
          aiStatus: mainDocument.aiStatus,
          businessCreated: mainDocument.businessCreated,
          createdAt: mainDocument.createdAt.toISOString(),
          updatedAt: mainDocument.updatedAt.toISOString()
        }
      : null,
    relatedEntity,
    linkedDocuments,
    payment: payment
      ? {
          id: payment.id,
          receivableAmount: payment.receivableAmount,
          receivedAmount: payment.receivedAmount,
          currency: payment.currency,
          status: payment.status,
          dueDate: payment.dueDate?.toISOString() ?? null,
          receivedAt: payment.receivedAt?.toISOString() ?? null,
          paidAt: payment.paidAt?.toISOString() ?? null
        }
      : null,
    receivable: receivable
      ? {
          id: receivable.id,
          amount: receivable.amount,
          receivedAmount: receivable.receivedAmount,
          currency: receivable.currency,
          dueDate: receivable.dueDate?.toISOString() ?? null,
          status: receivable.status
        }
      : null,
    traceability: {
      contractId: workOrder.contractId,
      batchId: workOrder.batchId,
      documentId: workOrder.documentId,
      relatedEntityType: workOrder.relatedEntityType,
      relatedEntityId: workOrder.relatedEntityId
    }
  };
}

function sortWorkOrders(items: ReturnType<typeof buildWorkOrderView>[]) {
  return [...items].sort((left, right) => {
    if (Number(left.statusMeta.isClosed) !== Number(right.statusMeta.isClosed)) {
      return Number(left.statusMeta.isClosed) - Number(right.statusMeta.isClosed);
    }

    if (left.reminderMeta.rank !== right.reminderMeta.rank) {
      return left.reminderMeta.rank - right.reminderMeta.rank;
    }

    if (left.priorityMeta.rank !== right.priorityMeta.rank) {
      return left.priorityMeta.rank - right.priorityMeta.rank;
    }

    const leftDue = left.dueTime ? new Date(left.dueTime).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueTime ? new Date(right.dueTime).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

workOrdersRouter.get("/", async (_request, response) => {
  const workOrders = await prisma.workOrder.findMany({
    select: {
      id: true,
      workOrderNo: true,
      type: true,
      title: true,
      content: true,
      responsibleDepartment: true,
      responsiblePerson: true,
      status: true,
      priority: true,
      startTime: true,
      dueTime: true,
      contractId: true,
      batchId: true,
      documentId: true,
      relatedEntityType: true,
      relatedEntityId: true,
      completionCondition: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const context = await loadWorkOrderContext(workOrders);
  const items = sortWorkOrders(workOrders.map((item) => buildWorkOrderView(item, context)));

  const summary = {
    total: items.length,
    pending: items.filter((item) => item.status === "PENDING").length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
    overdue: items.filter((item) => item.reminderMeta.isOverdue).length,
    completed: items.filter((item) => item.statusMeta.isClosed).length,
    dueSoon: items.filter((item) => item.reminderMeta.code === "DUE_SOON" || item.reminderMeta.code === "DUE_TODAY").length,
    highPriority: items.filter((item) => item.priority === "HIGH" || item.priority === "URGENT").length,
    departments: new Set(items.map((item) => item.responsibleDepartment).filter(Boolean)).size
  };

  const typeCounts = new Map<string, { label: string; count: number }>();
  const departmentCounts = new Map<string, number>();

  for (const item of items) {
    const typeCount = typeCounts.get(item.type) ?? { label: item.typeMeta.label, count: 0 };
    typeCount.count += 1;
    typeCounts.set(item.type, typeCount);

    if (item.responsibleDepartment) {
      departmentCounts.set(item.responsibleDepartment, (departmentCounts.get(item.responsibleDepartment) ?? 0) + 1);
    }
  }

  response.json({
    summary,
    filters: {
      statusOptions: [
        { value: "ALL", label: "全部工单", count: items.length },
        { value: "PENDING", label: "待办", count: items.filter((item) => item.status === "PENDING").length },
        { value: "IN_PROGRESS", label: "处理中", count: items.filter((item) => item.status === "IN_PROGRESS").length },
        { value: "OVERDUE", label: "已逾期", count: items.filter((item) => item.reminderMeta.isOverdue).length },
        { value: "COMPLETED", label: "已完成", count: items.filter((item) => item.statusMeta.isClosed).length }
      ],
      typeOptions: Array.from(typeCounts.entries()).map(([value, meta]) => ({
        value,
        label: meta.label,
        count: meta.count
      })),
      departmentOptions: Array.from(departmentCounts.entries()).map(([value, count]) => ({
        value,
        label: value,
        count
      }))
    },
    workOrders: items
  });
});

workOrdersRouter.get("/:id", async (request, response) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      workOrderNo: true,
      type: true,
      title: true,
      content: true,
      responsibleDepartment: true,
      responsiblePerson: true,
      status: true,
      priority: true,
      startTime: true,
      dueTime: true,
      contractId: true,
      batchId: true,
      documentId: true,
      relatedEntityType: true,
      relatedEntityId: true,
      completionCondition: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!workOrder) {
    response.status(404).json({ message: "未找到对应工单。" });
    return;
  }

  const context = await loadWorkOrderContext([workOrder]);
  const view = buildWorkOrderView(workOrder, context);

  const historyConditions = [];

  if (workOrder.relatedEntityType && workOrder.relatedEntityId) {
    historyConditions.push({
      entityType: workOrder.relatedEntityType,
      entityId: workOrder.relatedEntityId
    });
  }

  if (workOrder.documentId) {
    historyConditions.push({
      entityType: "Document",
      entityId: workOrder.documentId
    });
  }

  const auditLogs =
    historyConditions.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            OR: historyConditions
          },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: {
            id: true,
            action: true,
            username: true,
            createdAt: true
          }
        })
      : [];

  response.json({
    ...view,
    moduleNarrative: buildModuleNarrative(workOrder.type),
    documentRequirements: view.typeMeta.attachmentRequirements,
    executionChecklist: view.typeMeta.executionChecklist,
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary: buildAuditSummary(item.action)
    }))
  });
});
