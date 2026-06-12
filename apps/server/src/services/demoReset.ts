import fs from "node:fs/promises";
import path from "node:path";
import { type PrismaClient } from "@prisma/client";
import { documentsUploadDir, qrCodesUploadDir } from "../config/paths";
import { buildStandardDemoScenario, ensureDemoFoundation } from "./demoFoundation";

async function clearDirectoryContents(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(directoryPath, entry.name), {
        recursive: true,
        force: true
      })
    )
  );
}

export async function resetDemoEnvironment(prisma: PrismaClient) {
  const fileWarnings: string[] = [];

  try {
    await clearDirectoryContents(documentsUploadDir);
  } catch (error) {
    fileWarnings.push(
      error instanceof Error
        ? `清理上传单据目录失败：${error.message}`
        : "清理上传单据目录失败。"
    );
  }

  try {
    await clearDirectoryContents(qrCodesUploadDir);
  } catch (error) {
    fileWarnings.push(
      error instanceof Error
        ? `清理二维码图片目录失败：${error.message}`
        : "清理二维码图片目录失败。"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.reportSnapshot.deleteMany();
    await tx.notification.deleteMany();
    await tx.approvalStep.deleteMany();
    await tx.approval.deleteMany();
    await tx.workOrder.deleteMany();
    await tx.settlement.deleteMany();
    await tx.costItem.deleteMany();
    await tx.invoice.deleteMany();
    await tx.payable.deleteMany();
    await tx.receivable.deleteMany();
    await tx.payment.deleteMany();
    await tx.deliveryOrderItem.deleteMany();
    await tx.deliveryOrder.deleteMany();
    await tx.salesOrderItem.deleteMany();
    await tx.salesOrder.deleteMany();
    await tx.outboundOrder.deleteMany();
    await tx.inboundOrder.deleteMany();
    await tx.preReceiveOrder.deleteMany();
    await tx.customsClearance.deleteMany();
    await tx.shipmentNode.deleteMany();
    await tx.shipment.deleteMany();
    await tx.purchaseOrderItem.deleteMany();
    await tx.purchaseOrder.deleteMany();
    await tx.stocktakeItem.deleteMany();
    await tx.stocktakeOrder.deleteMany();
    await tx.inventorySnapshot.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.qrItem.deleteMany();
    await tx.contractItem.deleteMany();
    await tx.batch.deleteMany();
    await tx.contract.deleteMany();
    await tx.aiLog.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.documentChangeLog.deleteMany();
    await tx.documentMatchLog.deleteMany();
    await tx.documentPackageItem.deleteMany();
    await tx.documentPackageDraft.deleteMany();
    await tx.document.deleteMany();
    await tx.demoConfig.deleteMany();

    await ensureDemoFoundation(tx);
  });

  const [documents, contracts, batches, qrItems, stockMovements, purchaseOrders, shipments, workOrders, demoConfig] =
    await Promise.all([
      prisma.document.count(),
      prisma.contract.count(),
      prisma.batch.count(),
      prisma.qrItem.count(),
      prisma.stockMovement.count(),
      prisma.purchaseOrder.count(),
      prisma.shipment.count(),
      prisma.workOrder.count(),
      prisma.demoConfig.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        select: {
          scenarioName: true,
          origin: true,
          destinationWarehouse: true,
          customerName: true,
          supplierName: true,
          productName: true,
          totalQuantity: true,
          unit: true,
          plannedOutboundQuantity: true,
          amount: true,
          currency: true,
          updatedAt: true
        }
      })
    ]);

  return {
    message:
      fileWarnings.length > 0
        ? "演示业务数据已重置，系统已回到空白演示起点。存在少量文件清理警告。"
        : "演示业务数据已重置，系统已回到空白演示起点。",
    fileWarnings,
    preserved: {
      aiAssistantRuntimeConfig: true
    },
    standardScenario: buildStandardDemoScenario(),
    activeScenario: demoConfig,
    countsAfter: {
      documents,
      contracts,
      batches,
      qrItems,
      stockMovements,
      purchaseOrders,
      shipments,
      workOrders
    }
  };
}
