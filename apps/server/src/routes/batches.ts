import { Router } from "express";
import { QrItemStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const batchesRouter = Router();
const PALLET_SIZE = 10;

function buildHierarchySummary(
  qrItems: Array<{
    unitTraceCode?: string | null;
    boxTraceCode?: string | null;
    palletTraceCode?: string | null;
  }>
) {
  const unitCodes = new Set<string>();
  const boxCodes = new Set<string>();
  const palletCodes = new Set<string>();

  for (const item of qrItems) {
    if (item.unitTraceCode) {
      unitCodes.add(item.unitTraceCode);
    }

    if (item.boxTraceCode) {
      boxCodes.add(item.boxTraceCode);
    }

    if (item.palletTraceCode) {
      palletCodes.add(item.palletTraceCode);
    }
  }

  return {
    unitCount: unitCodes.size,
    boxCount: boxCodes.size,
    palletCount: palletCodes.size
  };
}

batchesRouter.get("/", async (_request, response) => {
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      batchNo: true,
      contractId: true,
      sku: true,
      productName: true,
      totalQuantity: true,
      unit: true,
      destinationWarehouse: true,
      warehouseId: true,
      status: true,
      sourceDocumentId: true,
      createdAt: true,
      updatedAt: true,
      sourceDocument: {
        select: {
          id: true,
          originalName: true
        }
      },
      contract: {
        select: {
          id: true,
          contractNo: true,
          customerName: true,
          supplierName: true
        }
      },
      qrItems: {
        select: {
          id: true,
          status: true,
          unitTraceCode: true,
          boxTraceCode: true,
          palletTraceCode: true
        }
      }
    }
  });

  response.json(
    batches.map((batch) => {
      const inStockCount = batch.qrItems.filter((item) => item.status === QrItemStatus.IN_STOCK).length;
      const pendingInboundCount = batch.qrItems.filter((item) => item.status === QrItemStatus.PENDING_INBOUND).length;
      const outboundCount = batch.qrItems.filter((item) => item.status === QrItemStatus.OUTBOUND).length;

      return {
        ...batch,
        qrSummary: {
          total: batch.qrItems.length,
          pendingInbound: pendingInboundCount,
          inStock: inStockCount,
          outbound: outboundCount
        },
        hierarchySummary:
          batch.qrItems.length > 0
            ? buildHierarchySummary(batch.qrItems)
            : {
                unitCount: 0,
                boxCount: 0,
                palletCount: Math.ceil(batch.totalQuantity / PALLET_SIZE)
              }
      };
    })
  );
});

batchesRouter.get("/:id", async (request, response) => {
  const batch = await prisma.batch.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      batchNo: true,
      contractId: true,
      skuId: true,
      sku: true,
      productName: true,
      totalQuantity: true,
      unit: true,
      destinationWarehouse: true,
      warehouseId: true,
      status: true,
      sourceDocumentId: true,
      createdAt: true,
      updatedAt: true,
      sourceDocument: {
        select: {
          id: true,
          originalName: true,
          fileUrl: true
        }
      },
      contract: {
        select: {
          id: true,
          contractNo: true,
          customerName: true,
          supplierName: true,
          amount: true,
          currency: true
        }
      },
      qrItems: {
        select: {
          id: true,
          qrCode: true,
          serialNo: true,
          status: true,
          createdAt: true,
          unitTraceCode: true,
          boxTraceCode: true,
          palletTraceCode: true,
          freezeReason: true,
          statusRemark: true
        },
        orderBy: {
          serialNo: "asc"
        }
      },
      stockMovements: {
        select: {
          id: true,
          movementType: true,
          fromStatus: true,
          toStatus: true,
          warehouseName: true,
          occurredAt: true
        },
        orderBy: {
          occurredAt: "desc"
        }
      }
    }
  });

  if (!batch) {
    response.status(404).json({ message: "Batch not found." });
    return;
  }

  const qrSummary = {
    total: batch.qrItems.length,
    pendingInbound: batch.qrItems.filter((item) => item.status === QrItemStatus.PENDING_INBOUND).length,
    inStock: batch.qrItems.filter((item) => item.status === QrItemStatus.IN_STOCK).length,
    outbound: batch.qrItems.filter((item) => item.status === QrItemStatus.OUTBOUND).length
  };

  response.json({
    ...batch,
    qrSummary,
    hierarchySummary: buildHierarchySummary(batch.qrItems)
  });
});
