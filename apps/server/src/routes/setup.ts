import { Router } from "express";
import { demoScenarioConfig } from "../config/demoScenario";
import { prisma } from "../lib/prisma";
import { buildStandardDemoScenario } from "../services/demoFoundation";
import { resetDemoEnvironment } from "../services/demoReset";

export const setupRouter = Router();
const RESET_DEMO_CONFIRMATION_PHRASE = "我是最高权限用户";
const RESET_DEMO_REQUIRED_ROLE = "OWNER";

setupRouter.get("/status", async (_request, response) => {
  const [counts, demoUser, activeDemoConfig] = await Promise.all([
    prisma.$transaction([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.userRole.count(),
      prisma.rolePermission.count(),
      prisma.company.count(),
      prisma.department.count(),
      prisma.sku.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.warehouse.count(),
      prisma.warehouseLocation.count(),
      prisma.vehicle.count(),
      prisma.driver.count(),
      prisma.demoConfig.count(),
      prisma.document.count(),
      prisma.documentChangeLog.count(),
      prisma.contract.count(),
      prisma.contractItem.count(),
      prisma.batch.count(),
      prisma.qrItem.count(),
      prisma.stockMovement.count(),
      prisma.inventorySnapshot.count(),
      prisma.stocktakeOrder.count(),
      prisma.stocktakeItem.count(),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrderItem.count(),
      prisma.shipment.count(),
      prisma.shipmentNode.count(),
      prisma.customsClearance.count(),
      prisma.warehouseAnomaly.count(),
      prisma.preReceiveOrder.count(),
      prisma.inboundOrder.count(),
      prisma.outboundOrder.count(),
      prisma.salesOrder.count(),
      prisma.salesOrderItem.count(),
      prisma.deliveryOrder.count(),
      prisma.deliveryOrderItem.count(),
      prisma.payment.count(),
      prisma.receivable.count(),
      prisma.payable.count(),
      prisma.invoice.count(),
      prisma.costItem.count(),
      prisma.exchangeRate.count(),
      prisma.bankAccount.count(),
      prisma.settlement.count(),
      prisma.workOrder.count(),
      prisma.approval.count(),
      prisma.approvalStep.count(),
      prisma.notification.count(),
      prisma.auditLog.count(),
      prisma.aiLog.count(),
      prisma.reportSnapshot.count()
    ]),
    prisma.user.findUnique({
      where: { username: "demo-owner" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        companyId: true,
        departmentId: true,
        createdAt: true
      }
    }),
    prisma.demoConfig.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
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
        customerId: true,
        supplierId: true,
        skuId: true,
        warehouseId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  const [
    users,
    roles,
    permissions,
    userRoles,
    rolePermissions,
    companies,
    departments,
    skus,
    customers,
    suppliers,
    warehouses,
    warehouseLocations,
    vehicles,
    drivers,
    demoConfigs,
    documents,
    documentChangeLogs,
    contracts,
    contractItems,
    batches,
    qrItems,
    stockMovements,
    inventorySnapshots,
    stocktakeOrders,
    stocktakeItems,
    purchaseOrders,
    purchaseOrderItems,
    shipments,
    shipmentNodes,
    customsClearances,
    warehouseAnomalies,
    preReceiveOrders,
    inboundOrders,
    outboundOrders,
    salesOrders,
    salesOrderItems,
    deliveryOrders,
    deliveryOrderItems,
    payments,
    receivables,
    payables,
    invoices,
    costItems,
    exchangeRates,
    bankAccounts,
    settlements,
    workOrders,
    approvals,
    approvalSteps,
    notifications,
    auditLogs,
    aiLogs,
    reportSnapshots
  ] = counts;

  response.json({
    database: {
      status: "ok",
      provider: "sqlite",
      counts: {
        users,
        roles,
        permissions,
        userRoles,
        rolePermissions,
        companies,
        departments,
        skus,
        customers,
        suppliers,
        warehouses,
        warehouseLocations,
        vehicles,
        drivers,
        documents,
        documentChangeLogs,
        contracts,
        contractItems,
        batches,
        qrItems,
        stockMovements,
        inventorySnapshots,
        stocktakeOrders,
        stocktakeItems,
        purchaseOrders,
        purchaseOrderItems,
        shipments,
        shipmentNodes,
        customsClearances,
        warehouseAnomalies,
        preReceiveOrders,
        inboundOrders,
        outboundOrders,
        salesOrders,
        salesOrderItems,
        deliveryOrders,
        deliveryOrderItems,
        payments,
        receivables,
        payables,
        invoices,
        costItems,
        exchangeRates,
        bankAccounts,
        settlements,
        workOrders,
        approvals,
        approvalSteps,
        notifications,
        auditLogs,
        aiLogs,
        reportSnapshots,
        demoConfigs
      }
    },
    demoUser,
    resetCapability: {
      enabled: true,
      action: "POST /api/setup/reset-demo",
      scope:
        "重置当前演示业务数据与演示文件，回到空白演示起点；基础组织、角色、仓库和运行时 AI 配置会被保留，默认单据图片请从 pics 目录手动上传。",
      confirmationRequired: true,
      confirmationPhrase: RESET_DEMO_CONFIRMATION_PHRASE,
      highestPrivilegeRole: RESET_DEMO_REQUIRED_ROLE
    },
    standardDemoScenario: buildStandardDemoScenario(),
    demoScenario: activeDemoConfig ?? {
      ...demoScenarioConfig,
      status: "ENV_FALLBACK"
    }
  });
});

setupRouter.post("/reset-demo", async (request, response) => {
  const highestPrivilegeConfirmed = request.body?.highestPrivilegeConfirmed === true;
  const confirmationText =
    typeof request.body?.confirmationText === "string" ? request.body.confirmationText.trim() : "";

  if (!highestPrivilegeConfirmed || confirmationText !== RESET_DEMO_CONFIRMATION_PHRASE) {
    response.status(403).json({
      message: `该操作只允许最高权限用户执行。请勾选确认并输入“${RESET_DEMO_CONFIRMATION_PHRASE}”后重试。`
    });
    return;
  }

  try {
    const result = await resetDemoEnvironment(prisma);

    response.json({
      ok: true,
      ...result
    });
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "重置演示环境失败。"
    });
  }
});
