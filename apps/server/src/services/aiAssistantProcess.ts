import { DocumentAiStatus, DocumentStatus, DocumentType, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getDashboardOverview } from "./dashboardOverview";
import { buildInventorySummary } from "./inventorySummary";

type Highlight = {
  label: string;
  value: string;
};

type StageSnapshot = {
  code: string;
  label: string;
  detail: string;
};

type ProcessFactsPayload = {
  references: {
    contractNo?: string;
    batchNo?: string;
  };
  highlights: Highlight[];
  data: {
    focus: {
      contractId: string | null;
      contractNo: string | null;
      customerName: string | null;
      batchId: string | null;
      batchNo: string | null;
      productName: string | null;
      warehouseName: string | null;
    };
    currentStage: StageSnapshot;
    nextAction: string;
    blockers: string[];
    dashboard: {
      generatedAt: string;
      mainFlowStatus: string | null;
      mainFlowStatusText: string | null;
      afterSalesStatusText: string | null;
      exceptionStatusText: string | null;
      archiveStatusText: string | null;
      contractTotalQuantity: number;
      contractExecutingQuantity: number;
      contractPendingExecutionQuantity: number;
      focusBatchQuantity: number;
      focusBatchInTransitQuantity: number;
      focusBatchInStockQuantity: number;
      focusBatchOutboundQuantity: number;
      unpaidAmount: number;
      currency: string;
      orderView: string;
    };
    modules: {
      documents: Record<string, unknown>;
      procurement: Record<string, unknown>;
      logistics: Record<string, unknown>;
      customs: Record<string, unknown>;
      warehouse: Record<string, unknown>;
      sales: Record<string, unknown>;
      finance: Record<string, unknown>;
      workOrders: Record<string, unknown>;
    };
    inventory: {
      contract: Record<string, unknown> | null;
      batch: Record<string, unknown> | null;
      global: Record<string, unknown>;
    };
    recentTasks: Array<{
      title: string;
      statusText: string;
      owner: string;
      routePath: string;
    }>;
    recentActivities: Array<{
      kind: string;
      title: string;
      occurredAt: string;
      routePath: string;
    }>;
  };
};

type ScopeFocus = {
  contract: {
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
  } | null;
  batch: {
    id: string;
    batchNo: string;
    contractId: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    status: string;
    destinationWarehouse: string;
    warehouseId: string | null;
  } | null;
};

function safeUpper(value: string | undefined) {
  return value?.trim().toUpperCase() ?? undefined;
}

function formatQuantity(value: number, unit = "箱") {
  return `${value}${unit}`;
}

function formatMoney(value: number, currency = "USD") {
  return `${Number(value.toFixed(2)).toLocaleString("zh-CN")} ${currency}`;
}

function calcOpenAmount(amount: number, receivedAmount: number) {
  return Number(Math.max(amount - receivedAmount, 0).toFixed(2));
}

function calcDueDays(dueDate: Date | null) {
  if (!dueDate) {
    return null;
  }

  const diffMs = dueDate.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function buildShipmentStageLabel(stage: string | null) {
  switch (stage) {
    case "ARRIVED_DESTINATION":
      return "到港待清关";
    case "DEPARTED":
      return "海运中";
    case "COLLECTION_COMPLETED":
      return "待离港";
    case "WAREHOUSE_DELIVERED":
      return "已交接仓储";
    default:
      return "待生成物流状态";
  }
}

function buildCustomsStatusLabel(status: string | null) {
  return status === "COMPLETED" ? "已完成清关" : "待清关";
}

function buildSalesStageLabel(deliveryStatus: string | null, signStatus: string | null) {
  if (signStatus === "SIGNED" || deliveryStatus === "DELIVERED" || deliveryStatus === "COMPLETED") {
    return "已配送完成";
  }

  if (deliveryStatus === "IN_TRANSIT" || deliveryStatus === "DELIVERING") {
    return "配送中";
  }

  return "待配送";
}

function buildFinanceStatusLabel(openAmount: number, receivedAmount: number) {
  if (openAmount <= 0) {
    return "已回款";
  }

  if (receivedAmount > 0) {
    return "部分回款";
  }

  return "待回款";
}

async function resolveExplicitFocus(contractNo?: string, batchNo?: string): Promise<ScopeFocus> {
  const normalizedBatchNo = safeUpper(batchNo);
  const normalizedContractNo = safeUpper(contractNo);

  if (normalizedBatchNo) {
    const batch = await prisma.batch.findFirst({
      where: {
        batchNo: {
          equals: normalizedBatchNo
        }
      },
      select: {
        id: true,
        batchNo: true,
        contractId: true,
        productName: true,
        totalQuantity: true,
        unit: true,
        status: true,
        destinationWarehouse: true,
        warehouseId: true,
        contract: {
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
            destinationWarehouse: true
          }
        }
      }
    });

    if (batch) {
      return {
        batch: {
          id: batch.id,
          batchNo: batch.batchNo,
          contractId: batch.contractId,
          productName: batch.productName,
          totalQuantity: batch.totalQuantity,
          unit: batch.unit,
          status: batch.status,
          destinationWarehouse: batch.destinationWarehouse,
          warehouseId: batch.warehouseId
        },
        contract: batch.contract
          ? {
              id: batch.contract.id,
              contractNo: batch.contract.contractNo,
              customerName: batch.contract.customerName,
              supplierName: batch.contract.supplierName,
              productName: batch.contract.productName,
              totalQuantity: batch.contract.totalQuantity,
              unit: batch.contract.unit,
              amount: batch.contract.amount,
              currency: batch.contract.currency,
              destinationWarehouse: batch.contract.destinationWarehouse
            }
          : null
      };
    }
  }

  if (normalizedContractNo) {
    const contract = await prisma.contract.findFirst({
      where: {
        contractNo: {
          equals: normalizedContractNo
        }
      },
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
        destinationWarehouse: true
      }
    });

    if (contract) {
      const batch = await prisma.batch.findFirst({
        where: { contractId: contract.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          batchNo: true,
          contractId: true,
          productName: true,
          totalQuantity: true,
          unit: true,
          status: true,
          destinationWarehouse: true,
          warehouseId: true
        }
      });

      return {
        contract: {
          id: contract.id,
          contractNo: contract.contractNo,
          customerName: contract.customerName,
          supplierName: contract.supplierName,
          productName: contract.productName,
          totalQuantity: contract.totalQuantity,
          unit: contract.unit,
          amount: contract.amount,
          currency: contract.currency,
          destinationWarehouse: contract.destinationWarehouse
        },
        batch: batch
          ? {
              id: batch.id,
              batchNo: batch.batchNo,
              contractId: batch.contractId,
              productName: batch.productName,
              totalQuantity: batch.totalQuantity,
              unit: batch.unit,
              status: batch.status,
              destinationWarehouse: batch.destinationWarehouse,
              warehouseId: batch.warehouseId
            }
          : null
      };
    }
  }

  return {
    contract: null,
    batch: null
  };
}

async function resolveProcessFocus(contractNo?: string, batchNo?: string) {
  const explicitFocus = await resolveExplicitFocus(contractNo, batchNo);
  const dashboard = await getDashboardOverview({
    orderView: "all",
    focusContractId: explicitFocus.contract?.id ?? undefined
  });

  if (explicitFocus.contract || explicitFocus.batch) {
    return {
      dashboard,
      focus: explicitFocus
    };
  }

  if (dashboard.focus.contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: dashboard.focus.contractId },
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
        destinationWarehouse: true
      }
    });

    const batch =
      (dashboard.focus.batchId
        ? await prisma.batch.findUnique({
            where: { id: dashboard.focus.batchId },
            select: {
              id: true,
              batchNo: true,
              contractId: true,
              productName: true,
              totalQuantity: true,
              unit: true,
              status: true,
              destinationWarehouse: true,
              warehouseId: true
            }
          })
        : null) ??
      (contract
        ? await prisma.batch.findFirst({
            where: { contractId: contract.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              batchNo: true,
              contractId: true,
              productName: true,
              totalQuantity: true,
              unit: true,
              status: true,
              destinationWarehouse: true,
              warehouseId: true
            }
          })
        : null);

    return {
      dashboard,
      focus: {
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
              destinationWarehouse: contract.destinationWarehouse
            }
          : null,
        batch: batch
          ? {
              id: batch.id,
              batchNo: batch.batchNo,
              contractId: batch.contractId,
              productName: batch.productName,
              totalQuantity: batch.totalQuantity,
              unit: batch.unit,
              status: batch.status,
              destinationWarehouse: batch.destinationWarehouse,
              warehouseId: batch.warehouseId
            }
          : null
      }
    };
  }

  const contract = await prisma.contract.findFirst({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
      destinationWarehouse: true
    }
  });
  const batch = contract
    ? await prisma.batch.findFirst({
        where: { contractId: contract.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          batchNo: true,
          contractId: true,
          productName: true,
          totalQuantity: true,
          unit: true,
          status: true,
          destinationWarehouse: true,
          warehouseId: true
        }
      })
    : null;

  return {
    dashboard,
    focus: {
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
            destinationWarehouse: contract.destinationWarehouse
          }
        : null,
      batch: batch
        ? {
            id: batch.id,
            batchNo: batch.batchNo,
            contractId: batch.contractId,
            productName: batch.productName,
            totalQuantity: batch.totalQuantity,
            unit: batch.unit,
            status: batch.status,
            destinationWarehouse: batch.destinationWarehouse,
            warehouseId: batch.warehouseId
          }
        : null
    }
  };
}

function deriveDocumentStage(input: {
  total: number;
  extracted: number;
  businessCreated: number;
  hasContract: boolean;
  hasPackingList: boolean;
  missingRequiredTypes: string[];
}) {
  if (input.total <= 0) {
    return {
      stage: {
        code: "DOCUMENT_PENDING_UPLOAD",
        label: "待上传单据",
        detail: "当前还没有上传合同与箱单。"
      },
      nextAction: "先在合同与单据页上传合同和箱单，再进行 AI 识别。",
      blockers: ["缺少合同与箱单，正式业务数据还没有起票。"] as string[]
    };
  }

  if (!input.hasContract || !input.hasPackingList) {
    return {
      stage: {
        code: "DOCUMENT_MISSING_REQUIRED",
        label: "单据未补齐",
        detail: `还缺少 ${input.missingRequiredTypes.join("、")}。`
      },
      nextAction: "补齐合同和箱单后，确认生成正式业务数据。",
      blockers: [`缺少必备单据：${input.missingRequiredTypes.join("、")}`]
    };
  }

  if (input.extracted <= 0) {
    return {
      stage: {
        code: "DOCUMENT_PENDING_AI",
        label: "待 AI 识别",
        detail: "单据已上传，但还没有完成字段识别。"
      },
      nextAction: "先执行 AI 识别，再人工确认识别结果。",
      blockers: ["单据还没有完成 AI 识别。"] as string[]
    };
  }

  if (input.businessCreated <= 0) {
    return {
      stage: {
        code: "DOCUMENT_PENDING_CONFIRM",
        label: "待确认生成业务数据",
        detail: "识别结果已就绪，但还没有生成正式合同与批次。"
      },
      nextAction: "人工确认识别结果后，点击“确认生成业务数据”。",
      blockers: ["正式合同、批次、采购单草稿还没有生成。"] as string[]
    };
  }

  return {
    stage: {
      code: "DOCUMENT_READY",
      label: "单据已转正式业务",
      detail: "合同与箱单已经进入正式业务数据层。"
    },
    nextAction: "",
    blockers: [] as string[]
  };
}

function deriveShipmentStage(shipment: {
  status: string;
  actualArrivalTime: Date | null;
} | null, customsStatus: string | null) {
  if (!shipment) {
    return "NOT_CREATED";
  }

  if (
    shipment.status === "PENDING_CUSTOMS" ||
    shipment.status === "ARRIVED_DESTINATION" ||
    customsStatus === "PENDING" ||
    customsStatus === "COMPLETED" ||
    shipment.actualArrivalTime
  ) {
    return "ARRIVED_DESTINATION";
  }

  if (shipment.status === "DEPARTED" || shipment.status === "IN_TRANSIT") {
    return "DEPARTED";
  }

  if (shipment.status === "WAREHOUSE_DELIVERED") {
    return "WAREHOUSE_DELIVERED";
  }

  return "COLLECTION_COMPLETED";
}

function deriveWarehouseStage(input: {
  totalQrItems: number;
  inTransitInventory: number;
  availableInventory: number;
  outboundQuantity: number;
}) {
  if (input.totalQrItems <= 0) {
    return {
      code: "QR_PENDING",
      label: "待生成二维码",
      detail: "当前批次还没有进入二维码执行层。"
    };
  }

  if (input.inTransitInventory > 0) {
    return {
      code: "WAREHOUSE_PENDING_INBOUND",
      label: "待扫码入库",
      detail: `还有 ${input.inTransitInventory} 箱待入库。`
    };
  }

  if (input.availableInventory > 0 && input.outboundQuantity <= 0) {
    return {
      code: "WAREHOUSE_IN_STOCK",
      label: "已入库待出库",
      detail: `当前在库 ${input.availableInventory} 箱。`
    };
  }

  if (input.availableInventory > 0 && input.outboundQuantity > 0) {
    return {
      code: "WAREHOUSE_PARTIAL_OUTBOUND",
      label: "部分出库中",
      detail: `已出库 ${input.outboundQuantity} 箱，仍有 ${input.availableInventory} 箱在库。`
    };
  }

  if (input.outboundQuantity > 0) {
    return {
      code: "WAREHOUSE_ALL_OUTBOUND",
      label: "批次已全部出库",
      detail: `该批次已累计出库 ${input.outboundQuantity} 箱。`
    };
  }

  return {
    code: "WAREHOUSE_IDLE",
    label: "待仓储执行",
    detail: "仓储链路还没有开始。"
  };
}

function deriveCurrentStage(input: {
  documentStage: StageSnapshot;
  procurementStatus: string | null;
  shipmentStage: string;
  customsStatus: string | null;
  warehouseStage: StageSnapshot;
  salesStageLabel: string;
  salesDelivered: boolean;
  financeOpenAmount: number;
}) {
  if (input.documentStage.code !== "DOCUMENT_READY") {
    return input.documentStage;
  }

  if (!input.procurementStatus) {
    return {
      code: "PROCUREMENT_PENDING",
      label: "待进入采购",
      detail: "正式业务数据已生成，但采购单还没有形成。"
    };
  }

  if (input.procurementStatus === "DRAFT") {
    return {
      code: "PROCUREMENT_DRAFT",
      label: "采购下单阶段",
      detail: "采购单已创建，待推进到供应商已发货。"
    };
  }

  if (input.procurementStatus === "SUPPLIER_SHIPPED") {
    return {
      code: "PROCUREMENT_COLLECTION",
      label: "国内集货阶段",
      detail: "供应商已发货，待推进到国内集货完成。"
    };
  }

  if (input.shipmentStage === "NOT_CREATED" || input.shipmentStage === "COLLECTION_COMPLETED") {
    return {
      code: "LOGISTICS_PENDING_DEPARTURE",
      label: "国际物流待离港",
      detail: "物流记录已准备，待推进到已离港。"
    };
  }

  if (input.shipmentStage === "DEPARTED") {
    return {
      code: "LOGISTICS_IN_TRANSIT",
      label: "国际物流海运中",
      detail: "货物已离港，当前处于海运途中。"
    };
  }

  if (input.customsStatus !== "COMPLETED") {
    return {
      code: "CUSTOMS_PENDING",
      label: "报关清关阶段",
      detail: "货物已到港，待完成清关。"
    };
  }

  if (input.warehouseStage.code !== "WAREHOUSE_ALL_OUTBOUND") {
    return input.warehouseStage;
  }

  if (!input.salesDelivered) {
    return {
      code: "SALES_DELIVERY",
      label: "销售与配送阶段",
      detail: `当前销售状态为${input.salesStageLabel}。`
    };
  }

  if (input.financeOpenAmount > 0) {
    return {
      code: "FINANCE_COLLECTION",
      label: "财务回款阶段",
      detail: "出库与配送已完成，当前待财务回款。"
    };
  }

  return {
    code: "PROCESS_COMPLETED",
    label: "全链路已基本完成",
    detail: "当前订单的主要流程、库存链路和回款链路都已到完成态。"
  };
}

export async function buildAiProcessStatusFacts(input: {
  contractNo?: string;
  batchNo?: string;
}): Promise<ProcessFactsPayload> {
  const { dashboard, focus } = await resolveProcessFocus(input.contractNo, input.batchNo);
  const contract = focus.contract;
  const batch = focus.batch;

  const [globalInventory, contractInventory, batchInventory, documents, purchaseOrder, shipment, customs, preReceiveOrder, inboundOrder, outboundOrder, salesOrder, contractReceivable, payment, workOrders] =
    await Promise.all([
      buildInventorySummary(),
      contract ? buildInventorySummary({ contractId: contract.id }) : Promise.resolve(null),
      batch ? buildInventorySummary({ batchId: batch.id }) : Promise.resolve(null),
      contract || batch
        ? prisma.document.findMany({
            where: {
              isDeleted: false,
              status: {
                not: DocumentStatus.DELETED
              },
              OR: [
                ...(contract ? [{ contractNoDraft: contract.contractNo }] : []),
                ...(batch ? [{ batchNoDraft: batch.batchNo }] : [])
              ]
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              documentType: true,
              status: true,
              aiStatus: true,
              businessCreated: true,
              originalName: true,
              updatedAt: true
            }
          })
        : Promise.resolve([]),
      batch || contract
        ? prisma.purchaseOrder.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              purchaseNo: true,
              supplierName: true,
              skuName: true,
              quantity: true,
              unit: true,
              status: true,
              deliveryDate: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.shipment.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
              status: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.customsClearance.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              clearanceNo: true,
              responsibleCompany: true,
              responsiblePerson: true,
              aiCheckResult: true,
              status: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.preReceiveOrder.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              preReceiveNo: true,
              status: true,
              quantity: true,
              unit: true,
              expectedArrivalTime: true,
              suggestedLocation: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.inboundOrder.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              inboundNo: true,
              status: true,
              quantity: true,
              unit: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.outboundOrder.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              outboundNo: true,
              status: true,
              quantity: true,
              unit: true
            }
          })
        : Promise.resolve(null),
      batch || contract
        ? prisma.salesOrder.findFirst({
            where: batch ? { batchId: batch.id } : { contractId: contract!.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              salesNo: true,
              customerName: true,
              skuName: true,
              quantity: true,
              unit: true,
              amount: true,
              currency: true,
              deliveryStatus: true,
              signStatus: true,
              status: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      contract
        ? prisma.receivable.findFirst({
            where: {
              contractId: contract.id,
              salesOrderId: null
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              amount: true,
              currency: true,
              dueDate: true,
              receivedAmount: true,
              status: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      contract
        ? prisma.payment.findFirst({
            where: { contractId: contract.id },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              receivableAmount: true,
              receivedAmount: true,
              currency: true,
              status: true,
              dueDate: true,
              paidAt: true,
              receivedAt: true,
              updatedAt: true
            }
          })
        : Promise.resolve(null),
      contract || batch
        ? prisma.workOrder.findMany({
            where: {
              OR: [
                ...(contract ? [{ contractId: contract.id }] : []),
                ...(batch ? [{ batchId: batch.id }] : [])
              ]
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            take: 10,
            select: {
              id: true,
              workOrderNo: true,
              title: true,
              type: true,
              status: true,
              priority: true,
              responsibleDepartment: true,
              dueTime: true,
              updatedAt: true
            }
          })
        : Promise.resolve([])
    ]);

  const [deliveryOrder, salesReceivable] = await Promise.all([
    salesOrder || batch
      ? prisma.deliveryOrder.findFirst({
          where: salesOrder ? { salesOrderId: salesOrder.id } : { batchId: batch!.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            deliveryNo: true,
            status: true,
            warehouseName: true,
            quantity: true,
            unit: true,
            updatedAt: true
          }
        })
      : Promise.resolve(null),
    salesOrder
      ? prisma.receivable.findFirst({
          where: { salesOrderId: salesOrder.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            amount: true,
            currency: true,
            dueDate: true,
            receivedAmount: true,
            status: true,
            updatedAt: true
          }
        })
      : Promise.resolve(null)
  ]);

  const requiredDocTypes = [DocumentType.CONTRACT, DocumentType.PACKING_LIST];
  const activeDocuments = documents.filter((item) => item.status !== DocumentStatus.DELETED && item.status !== DocumentStatus.VOIDED);
  const extractedCount = activeDocuments.filter((item) => item.aiStatus === DocumentAiStatus.EXTRACTED).length;
  const businessCreatedCount = activeDocuments.filter((item) => item.businessCreated).length;
  const presentDocTypes = new Set(activeDocuments.map((item) => item.documentType));
  const missingRequiredTypes = requiredDocTypes
    .filter((item) => !presentDocTypes.has(item))
    .map((item) => (item === DocumentType.CONTRACT ? "合同" : "箱单"));
  const documentStageMeta = deriveDocumentStage({
    total: activeDocuments.length,
    extracted: extractedCount,
    businessCreated: businessCreatedCount,
    hasContract: presentDocTypes.has(DocumentType.CONTRACT),
    hasPackingList: presentDocTypes.has(DocumentType.PACKING_LIST),
    missingRequiredTypes
  });

  const contractInventoryEntry = contractInventory?.byContract[0] ?? null;
  const batchInventoryEntry = batchInventory?.byBatch[0] ?? null;
  const financeRecord = salesReceivable ?? contractReceivable;
  const financeOpenAmount = financeRecord ? calcOpenAmount(financeRecord.amount, financeRecord.receivedAmount) : 0;
  const financeDueDays = calcDueDays(financeRecord?.dueDate ?? payment?.dueDate ?? null);
  const shipmentStage = deriveShipmentStage(shipment, customs?.status ?? null);
  const warehouseStage = deriveWarehouseStage({
    totalQrItems: batchInventoryEntry?.totalQrItems ?? contractInventoryEntry?.totalQrItems ?? 0,
    inTransitInventory: batchInventoryEntry?.inTransitInventory ?? contractInventoryEntry?.inTransitInventory ?? 0,
    availableInventory: batchInventoryEntry?.availableInventory ?? contractInventoryEntry?.availableInventory ?? 0,
    outboundQuantity: batchInventoryEntry?.outboundQuantity ?? contractInventoryEntry?.outboundQuantity ?? 0
  });
  const salesStageLabel = buildSalesStageLabel(salesOrder?.deliveryStatus ?? null, salesOrder?.signStatus ?? null);
  const currentStage = deriveCurrentStage({
    documentStage: documentStageMeta.stage,
    procurementStatus: purchaseOrder?.status ?? null,
    shipmentStage,
    customsStatus: customs?.status ?? null,
    warehouseStage,
    salesStageLabel,
    salesDelivered: salesStageLabel === "已配送完成",
    financeOpenAmount
  });

  const blockers: string[] = [...documentStageMeta.blockers];
  if (workOrders.some((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED" && item.dueTime && item.dueTime.getTime() < Date.now())) {
    blockers.push("存在已逾期的工单，需要优先处理。");
  }
  if (warehouseStage.code === "QR_PENDING") {
    blockers.push("该批次还没有生成二维码，无法进入真实扫码库存链路。");
  }
  if (financeOpenAmount > 0 && typeof financeDueDays === "number" && financeDueDays < 0) {
    blockers.push(`当前应收已逾期 ${Math.abs(financeDueDays)} 天。`);
  }

  let nextAction = documentStageMeta.nextAction;
  if (!nextAction) {
    switch (currentStage.code) {
      case "PROCUREMENT_PENDING":
      case "PROCUREMENT_DRAFT":
        nextAction = "推进采购单到“供应商已发货”，再继续国内集货。";
        break;
      case "PROCUREMENT_COLLECTION":
        nextAction = "将采购状态推进到“国内集货完成”，系统会联动生成国际物流记录。";
        break;
      case "LOGISTICS_PENDING_DEPARTURE":
        nextAction = "在国际物流模块把运输状态推进到“已离港”。";
        break;
      case "LOGISTICS_IN_TRANSIT":
        nextAction = "在国际物流模块把运输状态推进到“到达目的港”，系统会联动清关任务。";
        break;
      case "CUSTOMS_PENDING":
        nextAction = "完成清关，系统会自动生成境外陆运与仓库预收货任务。";
        break;
      case "QR_PENDING":
        nextAction = "先为该批次生成唯一二维码，再进入扫码入库。";
        break;
      case "WAREHOUSE_PENDING_INBOUND":
        nextAction = "进入仓储管理执行扫码入库，库存会按二维码状态真实变化。";
        break;
      case "WAREHOUSE_IN_STOCK":
      case "WAREHOUSE_PARTIAL_OUTBOUND":
        nextAction = "进入仓储管理执行扫码出库，并在销售模块推进配送状态。";
        break;
      case "SALES_DELIVERY":
        nextAction = "完成销售配送后，系统会联动财务回款跟进。";
        break;
      case "FINANCE_COLLECTION":
        nextAction = "进入财务回款模块登记部分或全部回款，直到进入可核销状态。";
        break;
      default:
        nextAction = "当前主链路已接近完成，可结合工单中心检查是否还有待办，并视情况归档。";
        break;
    }
  }

  const documentsModule = {
    statusLabel: documentStageMeta.stage.label,
    detail: documentStageMeta.stage.detail,
    total: activeDocuments.length,
    extracted: extractedCount,
    businessCreated: businessCreatedCount,
    missingRequiredTypes,
    latestDocuments: activeDocuments.slice(0, 4).map((item) => ({
      id: item.id,
      documentType: item.documentType,
      originalName: item.originalName,
      aiStatus: item.aiStatus,
      businessCreated: item.businessCreated,
      updatedAt: item.updatedAt.toISOString()
    }))
  };

  const procurementModule = purchaseOrder
    ? {
        exists: true,
        purchaseNo: purchaseOrder.purchaseNo,
        supplierName: purchaseOrder.supplierName,
        quantity: purchaseOrder.quantity,
        unit: purchaseOrder.unit,
        status: purchaseOrder.status,
        statusLabel:
          purchaseOrder.status === "COLLECTION_COMPLETED"
            ? "国内集货完成"
            : purchaseOrder.status === "SUPPLIER_SHIPPED"
              ? "供应商已发货"
              : "采购下单",
        deliveryDate: purchaseOrder.deliveryDate?.toISOString() ?? null,
        updatedAt: purchaseOrder.updatedAt.toISOString()
      }
    : {
        exists: false,
        status: "NOT_CREATED",
        statusLabel: "待创建采购单"
      };

  const logisticsModule = shipment
    ? {
        exists: true,
        shipmentNo: shipment.shipmentNo,
        status: shipment.status,
        stage: shipmentStage,
        stageLabel: buildShipmentStageLabel(shipmentStage),
        shippingCompany: shipment.shippingCompany,
        billOfLadingNo: shipment.billOfLadingNo,
        containerNo: shipment.containerNo,
        originPort: shipment.originPort,
        destinationPort: shipment.destinationPort,
        departureTime: shipment.departureTime?.toISOString() ?? null,
        estimatedArrivalTime: shipment.estimatedArrivalTime?.toISOString() ?? null,
        actualArrivalTime: shipment.actualArrivalTime?.toISOString() ?? null,
        updatedAt: shipment.updatedAt.toISOString()
      }
    : {
        exists: false,
        stage: "NOT_CREATED",
        stageLabel: "待生成物流记录"
      };

  const customsAiCheck = (() => {
    if (!customs?.aiCheckResult || typeof customs.aiCheckResult !== "object" || Array.isArray(customs.aiCheckResult)) {
      return null;
    }

    const payload = customs.aiCheckResult as Record<string, unknown>;
    return {
      packingListQuantity: typeof payload.packingListQuantity === "string" ? payload.packingListQuantity : null,
      invoiceQuantity: typeof payload.invoiceQuantity === "string" ? payload.invoiceQuantity : null,
      billOfLadingContainerNo:
        typeof payload.billOfLadingContainerNo === "string" ? payload.billOfLadingContainerNo : null,
      aiConclusion: typeof payload.aiConclusion === "string" ? payload.aiConclusion : null
    };
  })();

  const customsModule = customs
    ? {
        exists: true,
        clearanceNo: customs.clearanceNo,
        status: customs.status,
        statusLabel: buildCustomsStatusLabel(customs.status),
        responsibleCompany: customs.responsibleCompany,
        responsiblePerson: customs.responsiblePerson,
        aiCheckResult: customsAiCheck,
        updatedAt: customs.updatedAt.toISOString()
      }
    : {
        exists: false,
        status: "NOT_CREATED",
        statusLabel: "待生成清关任务"
      };

  const warehouseModule = {
    stage: warehouseStage.code,
    statusLabel: warehouseStage.label,
    detail: warehouseStage.detail,
    preReceiveOrder: preReceiveOrder
      ? {
          preReceiveNo: preReceiveOrder.preReceiveNo,
          status: preReceiveOrder.status,
          quantity: preReceiveOrder.quantity,
          unit: preReceiveOrder.unit,
          expectedArrivalTime: preReceiveOrder.expectedArrivalTime?.toISOString() ?? null,
          suggestedLocation: preReceiveOrder.suggestedLocation
        }
      : null,
    inboundOrder: inboundOrder
      ? {
          inboundNo: inboundOrder.inboundNo,
          status: inboundOrder.status,
          quantity: inboundOrder.quantity,
          unit: inboundOrder.unit
        }
      : null,
    outboundOrder: outboundOrder
      ? {
          outboundNo: outboundOrder.outboundNo,
          status: outboundOrder.status,
          quantity: outboundOrder.quantity,
          unit: outboundOrder.unit
        }
      : null,
    qrSummary: batchInventoryEntry
      ? {
          total: batchInventoryEntry.totalQrItems,
          inTransit: batchInventoryEntry.inTransitInventory,
          inStock: batchInventoryEntry.availableInventory,
          outbound: batchInventoryEntry.outboundQuantity,
          frozen: batchInventoryEntry.frozenInventory,
          abnormal: batchInventoryEntry.abnormalQuantity
        }
      : contractInventoryEntry
        ? {
            total: contractInventoryEntry.totalQrItems,
            inTransit: contractInventoryEntry.inTransitInventory,
            inStock: contractInventoryEntry.availableInventory,
            outbound: contractInventoryEntry.outboundQuantity,
            frozen: contractInventoryEntry.frozenInventory,
            abnormal: contractInventoryEntry.abnormalQuantity
          }
        : {
            total: 0,
            inTransit: 0,
            inStock: 0,
            outbound: 0,
            frozen: 0,
            abnormal: 0
          }
  };

  const salesModule = salesOrder
    ? {
        exists: true,
        salesNo: salesOrder.salesNo,
        status: salesOrder.status,
        stageLabel: salesStageLabel,
        deliveryStatus: salesOrder.deliveryStatus,
        signStatus: salesOrder.signStatus,
        quantity: salesOrder.quantity,
        unit: salesOrder.unit,
        amount: salesOrder.amount,
        currency: salesOrder.currency,
        deliveryOrder: deliveryOrder
          ? {
              deliveryNo: deliveryOrder.deliveryNo,
              status: deliveryOrder.status,
              warehouseName: deliveryOrder.warehouseName,
              quantity: deliveryOrder.quantity,
              unit: deliveryOrder.unit
            }
          : null,
        updatedAt: salesOrder.updatedAt.toISOString()
      }
    : {
        exists: false,
        status: "NOT_CREATED",
        stageLabel: "待生成销售单"
      };

  const financeModule = {
    receivable: financeRecord
      ? {
          id: financeRecord.id,
          status: financeRecord.status,
          statusLabel: buildFinanceStatusLabel(financeOpenAmount, financeRecord.receivedAmount),
          amount: financeRecord.amount,
          receivedAmount: financeRecord.receivedAmount,
          openAmount: financeOpenAmount,
          currency: financeRecord.currency,
          dueDate: financeRecord.dueDate?.toISOString() ?? null,
          dueDays: financeDueDays
        }
      : null,
    payment: payment
      ? {
          id: payment.id,
          status: payment.status,
          statusLabel:
            payment.status === PaymentStatus.PAID
              ? "已回款"
              : payment.status === PaymentStatus.PARTIAL
                ? "部分回款"
                : "待回款",
          receivableAmount: payment.receivableAmount,
          receivedAmount: payment.receivedAmount,
          currency: payment.currency,
          dueDate: payment.dueDate?.toISOString() ?? null,
          receivedAt: payment.receivedAt?.toISOString() ?? null,
          paidAt: payment.paidAt?.toISOString() ?? null
        }
      : null,
    openAmount: financeOpenAmount,
    statusLabel: financeRecord
      ? buildFinanceStatusLabel(financeOpenAmount, financeRecord.receivedAmount)
      : "待生成应收"
  };

  const openWorkOrders = workOrders.filter((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED");
  const overdueWorkOrders = openWorkOrders.filter((item) => item.dueTime && item.dueTime.getTime() < Date.now());
  const workOrdersModule = {
    total: workOrders.length,
    openCount: openWorkOrders.length,
    overdueCount: overdueWorkOrders.length,
    latestOpenItems: openWorkOrders.slice(0, 5).map((item) => ({
      workOrderNo: item.workOrderNo,
      title: item.title,
      type: item.type,
      status: item.status,
      priority: item.priority,
      responsibleDepartment: item.responsibleDepartment,
      dueTime: item.dueTime?.toISOString() ?? null,
      updatedAt: item.updatedAt.toISOString()
    }))
  };

  const highlights: Highlight[] = [
    { label: "当前环节", value: currentStage.label },
    { label: "主合同", value: contract?.contractNo ?? "-" },
    { label: "主批次", value: batch?.batchNo ?? "-" },
    {
      label: "在途 / 在库 / 已出库",
      value: `${batchInventoryEntry?.inTransitInventory ?? contractInventoryEntry?.inTransitInventory ?? 0} / ${
        batchInventoryEntry?.availableInventory ?? contractInventoryEntry?.availableInventory ?? 0
      } / ${batchInventoryEntry?.outboundQuantity ?? contractInventoryEntry?.outboundQuantity ?? 0}`
    },
    {
      label: "财务状态",
      value: financeRecord
        ? buildFinanceStatusLabel(financeOpenAmount, financeRecord.receivedAmount)
        : "待生成应收"
    }
  ];

  return {
    references: {
      contractNo: contract?.contractNo,
      batchNo: batch?.batchNo
    },
    highlights,
    data: {
      focus: {
        contractId: contract?.id ?? null,
        contractNo: contract?.contractNo ?? null,
        customerName: contract?.customerName ?? null,
        batchId: batch?.id ?? null,
        batchNo: batch?.batchNo ?? null,
        productName: batch?.productName ?? contract?.productName ?? null,
        warehouseName: batch?.destinationWarehouse ?? contract?.destinationWarehouse ?? null
      },
      currentStage,
      nextAction,
      blockers,
      dashboard: {
        generatedAt: dashboard.generatedAt,
        mainFlowStatus: dashboard.focus.mainFlowStatus,
        mainFlowStatusText: dashboard.focus.mainFlowStatusText,
        afterSalesStatusText: dashboard.focus.afterSalesStatusText,
        exceptionStatusText: dashboard.focus.exceptionStatusText,
        archiveStatusText: dashboard.focus.archiveStatusText,
        contractTotalQuantity: dashboard.execution.contractTotalQuantity,
        contractExecutingQuantity: dashboard.execution.contractExecutingQuantity,
        contractPendingExecutionQuantity: dashboard.execution.contractPendingExecutionQuantity,
        focusBatchQuantity: dashboard.execution.focusBatchQuantity,
        focusBatchInTransitQuantity: dashboard.execution.focusBatchInTransitQuantity,
        focusBatchInStockQuantity: dashboard.execution.focusBatchInStockQuantity,
        focusBatchOutboundQuantity: dashboard.execution.focusBatchOutboundQuantity,
        unpaidAmount: dashboard.finance.unpaidAmount,
        currency: dashboard.finance.currency,
        orderView: dashboard.orderView
      },
      modules: {
        documents: documentsModule,
        procurement: procurementModule,
        logistics: logisticsModule,
        customs: customsModule,
        warehouse: warehouseModule,
        sales: salesModule,
        finance: financeModule,
        workOrders: workOrdersModule
      },
      inventory: {
        contract: contractInventoryEntry,
        batch: batchInventoryEntry,
        global: globalInventory.summary
      },
      recentTasks: dashboard.recentTasks.slice(0, 4).map((item) => ({
        title: item.title,
        statusText: item.statusText,
        owner: item.owner,
        routePath: item.routePath
      })),
      recentActivities: dashboard.recentActivities.slice(0, 6).map((item) => ({
        kind: item.kind,
        title: item.title,
        occurredAt: item.occurredAt,
        routePath: item.routePath
      }))
    }
  };
}
