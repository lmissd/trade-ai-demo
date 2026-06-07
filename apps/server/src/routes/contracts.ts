import { Router } from "express";
import { prisma } from "../lib/prisma";

export const contractsRouter = Router();

contractsRouter.get("/", async (_request, response) => {
  const [contracts, receivables] = await Promise.all([
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        contractNo: true,
        status: true,
        paymentStatus: true,
        customerName: true,
        supplierName: true,
        productName: true,
        totalQuantity: true,
        unit: true,
        amount: true,
        currency: true,
        destinationWarehouse: true,
        sourceDocumentId: true,
        createdAt: true,
        updatedAt: true,
        sourceDocument: {
          select: {
            id: true,
            originalName: true
          }
        },
        batches: {
          select: {
            id: true,
            batchNo: true,
            status: true
          }
        },
        payments: {
          select: {
            id: true,
            receivableAmount: true,
            receivedAmount: true,
            currency: true,
            status: true,
            dueDate: true
          }
        }
      }
    }),
    prisma.receivable.findMany({
      select: {
        id: true,
        contractId: true,
        amount: true,
        receivedAmount: true,
        currency: true,
        status: true,
        dueDate: true
      }
    })
  ]);

  const receivableByContractId = new Map(
    receivables
      .filter((item) => item.contractId)
      .map((item) => [item.contractId as string, item])
  );

  response.json(
    contracts.map((contract) => ({
      ...contract,
      receivable: receivableByContractId.get(contract.id) ?? null
    }))
  );
});

contractsRouter.get("/:id", async (request, response) => {
  const contract = await prisma.contract.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      contractNo: true,
      contractType: true,
      status: true,
      paymentStatus: true,
      customerId: true,
      customerName: true,
      supplierId: true,
      supplierName: true,
      companyId: true,
      productName: true,
      totalQuantity: true,
      unit: true,
      amount: true,
      currency: true,
      destinationWarehouse: true,
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
      batches: {
        select: {
          id: true,
          batchNo: true,
          status: true,
          productName: true,
          totalQuantity: true,
          unit: true,
          destinationWarehouse: true,
          createdAt: true
        }
      },
      payments: {
        select: {
          id: true,
          receivableAmount: true,
          receivedAmount: true,
          currency: true,
          status: true,
          dueDate: true,
          createdAt: true
        }
      }
    }
  });

  if (!contract) {
    response.status(404).json({ message: "Contract not found." });
    return;
  }

  const [items, purchaseOrders, receivables] = await Promise.all([
    prisma.contractItem.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        skuCode: true,
        skuName: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        amount: true,
        currency: true
      }
    }),
    prisma.purchaseOrder.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        purchaseNo: true,
        status: true,
        supplierName: true,
        skuName: true,
        quantity: true,
        unit: true,
        deliveryDate: true,
        createdAt: true
      }
    }),
    prisma.receivable.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        receivedAmount: true,
        status: true,
        dueDate: true,
        createdAt: true
      }
    })
  ]);

  response.json({
    ...contract,
    items,
    purchaseOrders,
    receivables
  });
});
