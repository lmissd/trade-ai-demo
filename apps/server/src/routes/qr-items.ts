import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { BatchStatus, QrItemStatus } from "@prisma/client";
import QRCode from "qrcode";
import { qrCodesUploadDir, uploadsRoot } from "../config/paths";
import { prisma } from "../lib/prisma";

fs.mkdirSync(qrCodesUploadDir, { recursive: true });

export const qrItemsRouter = Router();

const PALLET_SIZE = 10;

type QrItemListResponse = {
  id: string;
  qrCode: string;
  serialNo: number;
  status: QrItemStatus;
  unitTraceCode: string | null;
  boxTraceCode: string | null;
  palletTraceCode: string | null;
  freezeReason: string | null;
  statusRemark: string | null;
  productName: string | null;
  currentWarehouse: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  batch: {
    id: string;
    batchNo: string;
    status: BatchStatus;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
  } | null;
};

function buildQrSvgFileName(batchNo: string, serialNo: number) {
  return `${batchNo}-${String(serialNo).padStart(4, "0")}.svg`;
}

function buildQrImageUrl(fileName: string) {
  return `/uploads/qr-codes/${fileName}`;
}

function buildTraceCode(batchNo: string, level: "UNIT" | "BOX" | "PALLET", sequenceNo: number) {
  const padded = String(sequenceNo).padStart(4, "0");

  if (level === "UNIT") {
    return `${batchNo}-UNIT-${padded}`;
  }

  if (level === "BOX") {
    return `${batchNo}-BOX-${padded}`;
  }

  return `${batchNo}-PLT-${padded}`;
}

function countQrSummary(items: Array<{ status: QrItemStatus }>) {
  return {
    total: items.length,
    pendingInbound: items.filter((item) => item.status === QrItemStatus.PENDING_INBOUND).length,
    inStock: items.filter((item) => item.status === QrItemStatus.IN_STOCK).length,
    outbound: items.filter((item) => item.status === QrItemStatus.OUTBOUND).length
  };
}

async function ensureQrSvgFile(qrCode: string, fileName: string) {
  const absolutePath = path.join(qrCodesUploadDir, fileName);

  if (fs.existsSync(absolutePath)) {
    return buildQrImageUrl(fileName);
  }

  const svg = await QRCode.toString(qrCode, {
    type: "svg",
    margin: 1,
    width: 240
  });

  fs.writeFileSync(absolutePath, svg, "utf8");
  return buildQrImageUrl(fileName);
}

qrItemsRouter.post("/generate", async (request, response) => {
  const payload = request.body as { batchId?: string } | undefined;
  const batchId = payload?.batchId?.trim();

  if (!batchId) {
    response.status(400).json({ message: "batchId is required." });
    return;
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      contract: {
        select: {
          id: true,
          contractNo: true,
          customerName: true,
          supplierName: true
        }
      },
      qrItems: {
        orderBy: {
          serialNo: "asc"
        }
      }
    }
  });

  if (!batch) {
    response.status(404).json({ message: "Batch not found." });
    return;
  }

  if (batch.qrItems.length > 0) {
    const existingItems = await Promise.all(
      batch.qrItems.map(async (item) => {
        const fileName = buildQrSvgFileName(batch.batchNo, item.serialNo);
        const imageUrl = await ensureQrSvgFile(item.qrCode, fileName);

        return {
          id: item.id,
          qrCode: item.qrCode,
          serialNo: item.serialNo,
          status: item.status,
          unitTraceCode: item.unitTraceCode,
          boxTraceCode: item.boxTraceCode,
          palletTraceCode: item.palletTraceCode,
          imageUrl
        };
      })
    );

    response.json({
      created: false,
      message: "This batch already has generated QR items.",
      batch: {
        id: batch.id,
        batchNo: batch.batchNo,
        status: batch.status,
        totalQuantity: batch.totalQuantity,
        unit: batch.unit
      },
      qrSummary: countQrSummary(batch.qrItems),
      hierarchySummary: {
        unitCount: batch.qrItems.length,
        boxCount: batch.qrItems.length,
        palletCount: Math.ceil(batch.qrItems.length / PALLET_SIZE)
      },
      items: existingItems
    });
    return;
  }

  const createdItems = await prisma.$transaction(async (tx) => {
    const items = [];

    for (let serialNo = 1; serialNo <= batch.totalQuantity; serialNo += 1) {
      const qrCode = `${batch.batchNo}-${String(serialNo).padStart(4, "0")}`;
      const unitTraceCode = buildTraceCode(batch.batchNo, "UNIT", serialNo);
      const boxTraceCode = buildTraceCode(batch.batchNo, "BOX", serialNo);
      const palletTraceCode = buildTraceCode(batch.batchNo, "PALLET", Math.ceil(serialNo / PALLET_SIZE));

      const createdItem = await tx.qrItem.create({
        data: {
          qrCode,
          batchId: batch.id,
          contractId: batch.contractId,
          skuId: batch.skuId,
          serialNo,
          productName: batch.productName,
          status: QrItemStatus.PENDING_INBOUND,
          currentWarehouse: batch.destinationWarehouse,
          warehouseId: batch.warehouseId,
          unitTraceCode,
          boxTraceCode,
          palletTraceCode
        }
      });

      items.push(createdItem);
    }

    await tx.batch.update({
      where: { id: batch.id },
      data: {
        status: BatchStatus.READY_FOR_QR
      }
    });

    return items;
  });

  const itemsWithImages = await Promise.all(
    createdItems.map(async (item) => {
      const fileName = buildQrSvgFileName(batch.batchNo, item.serialNo);
      const imageUrl = await ensureQrSvgFile(item.qrCode, fileName);

      return {
        id: item.id,
        qrCode: item.qrCode,
        serialNo: item.serialNo,
        status: item.status,
        unitTraceCode: item.unitTraceCode,
        boxTraceCode: item.boxTraceCode,
        palletTraceCode: item.palletTraceCode,
        imageUrl
      };
    })
  );

  response.json({
    created: true,
    message: "QR items generated successfully.",
    batch: {
      id: batch.id,
      batchNo: batch.batchNo,
      status: batch.status,
      totalQuantity: batch.totalQuantity,
      unit: batch.unit
    },
    qrSummary: {
      total: createdItems.length,
      pendingInbound: createdItems.length,
      inStock: 0,
      outbound: 0
    },
    hierarchySummary: {
      unitCount: createdItems.length,
      boxCount: createdItems.length,
      palletCount: Math.ceil(createdItems.length / PALLET_SIZE)
    },
    items: itemsWithImages
  });
});

qrItemsRouter.get("/", async (request, response) => {
  const batchId =
    typeof request.query.batchId === "string" && request.query.batchId.trim().length > 0
      ? request.query.batchId.trim()
      : null;
  const status =
    typeof request.query.status === "string" && request.query.status.trim().length > 0
      ? request.query.status.trim()
      : null;
  const keyword =
    typeof request.query.keyword === "string" && request.query.keyword.trim().length > 0
      ? request.query.keyword.trim()
      : null;

  const qrItems = await prisma.qrItem.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      ...(status ? { status: status as QrItemStatus } : {}),
      ...(keyword
        ? {
            OR: [
              { qrCode: { contains: keyword } },
              { unitTraceCode: { contains: keyword } },
              { boxTraceCode: { contains: keyword } },
              { palletTraceCode: { contains: keyword } },
              { productName: { contains: keyword } },
              { batch: { batchNo: { contains: keyword } } },
              { batch: { contract: { contractNo: { contains: keyword } } } }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { serialNo: "asc" }],
    include: {
      batch: {
        select: {
          id: true,
          batchNo: true,
          status: true,
          totalQuantity: true,
          unit: true,
          destinationWarehouse: true,
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

  const payload: QrItemListResponse[] = await Promise.all(
    qrItems.map(async (item) => {
      const fileName = buildQrSvgFileName(item.batch.batchNo, item.serialNo);
      const imageUrl = await ensureQrSvgFile(item.qrCode, fileName);

      return {
        id: item.id,
        qrCode: item.qrCode,
        serialNo: item.serialNo,
        status: item.status,
        unitTraceCode: item.unitTraceCode,
        boxTraceCode: item.boxTraceCode,
        palletTraceCode: item.palletTraceCode,
        freezeReason: item.freezeReason,
        statusRemark: item.statusRemark,
        productName: item.productName,
        currentWarehouse: item.currentWarehouse,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        imageUrl,
        batch: {
          id: item.batch.id,
          batchNo: item.batch.batchNo,
          status: item.batch.status,
          totalQuantity: item.batch.totalQuantity,
          unit: item.batch.unit,
          destinationWarehouse: item.batch.destinationWarehouse
        },
        contract: item.batch.contract
      };
    })
  );

  response.json(payload);
});

qrItemsRouter.get("/:id", async (request, response) => {
  const qrItem = await prisma.qrItem.findUnique({
    where: { id: request.params.id },
    include: {
      batch: {
        select: {
          id: true,
          batchNo: true,
          status: true,
          totalQuantity: true,
          unit: true,
          destinationWarehouse: true,
          contract: {
            select: {
              id: true,
              contractNo: true,
              customerName: true,
              supplierName: true,
              amount: true,
              currency: true
            }
          }
        }
      },
      stockMovements: {
        orderBy: {
          occurredAt: "desc"
        },
        select: {
          id: true,
          movementType: true,
          fromStatus: true,
          toStatus: true,
          warehouseName: true,
          occurredAt: true,
          note: true,
          remark: true
        }
      }
    }
  });

  if (!qrItem) {
    response.status(404).json({ message: "QR item not found." });
    return;
  }

  const fileName = buildQrSvgFileName(qrItem.batch.batchNo, qrItem.serialNo);
  const imageUrl = await ensureQrSvgFile(qrItem.qrCode, fileName);

  response.json({
    id: qrItem.id,
    qrCode: qrItem.qrCode,
    serialNo: qrItem.serialNo,
    status: qrItem.status,
    productName: qrItem.productName,
    currentWarehouse: qrItem.currentWarehouse,
    warehouseId: qrItem.warehouseId,
    locationId: qrItem.locationId,
    unitTraceCode: qrItem.unitTraceCode,
    boxTraceCode: qrItem.boxTraceCode,
    palletTraceCode: qrItem.palletTraceCode,
    freezeReason: qrItem.freezeReason,
    statusRemark: qrItem.statusRemark,
    inboundAt: qrItem.inboundAt,
    outboundAt: qrItem.outboundAt,
    createdAt: qrItem.createdAt,
    updatedAt: qrItem.updatedAt,
    imageUrl,
    imageFilePath: path.join(uploadsRoot, "qr-codes", fileName),
    batch: qrItem.batch,
    contract: qrItem.batch.contract,
    stockMovements: qrItem.stockMovements
  });
});
