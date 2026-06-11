import { Router } from "express";
import { prisma } from "../lib/prisma";

type MasterDataDomain = "skus" | "customers" | "suppliers" | "users" | "vehicles" | "drivers";

const allowedStatuses = new Set(["ACTIVE", "INACTIVE", "SUSPENDED", "MAINTENANCE"]);

export const masterDataRouter = Router();

function toIso(value: Date) {
  return value.toISOString();
}

function mapStatus(status: string | null | undefined) {
  if (status === "ACTIVE") {
    return {
      label: "启用",
      color: "success" as const
    };
  }

  if (status === "MAINTENANCE") {
    return {
      label: "维护中",
      color: "warning" as const
    };
  }

  if (status === "SUSPENDED") {
    return {
      label: "暂停",
      color: "warning" as const
    };
  }

  return {
    label: "停用",
    color: "default" as const
  };
}

function compactContact(input: { contactName?: string | null; phone?: string | null; email?: string | null }) {
  return [input.contactName, input.phone, input.email].filter(Boolean).join(" / ") || "-";
}

async function getActor() {
  const demoOwner = await prisma.user.findUnique({
    where: { username: "demo-owner" },
    select: {
      id: true,
      username: true
    }
  });

  return {
    userId: demoOwner?.id ?? null,
    username: demoOwner?.username ?? "demo-owner"
  };
}

async function writeMasterDataAudit(input: {
  userId: string | null;
  username: string | null;
  domain: MasterDataDomain;
  entityId: string;
  beforeStatus?: string | null;
  afterStatus: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      username: input.username,
      action: "MASTER_DATA_STATUS_UPDATE",
      entityType: input.domain,
      entityId: input.entityId,
      beforeJson: input.beforeStatus ? { status: input.beforeStatus } : undefined,
      afterJson: { status: input.afterStatus }
    }
  });
}

async function buildMasterDataOverview() {
  const [companies, departments, skus, customers, suppliers, users, vehicles, drivers] = await Promise.all([
    prisma.company.findMany({
      orderBy: [{ companyCode: "asc" }],
      select: {
        id: true,
        companyCode: true,
        name: true,
        country: true,
        companyType: true,
        status: true
      }
    }),
    prisma.department.findMany({
      orderBy: [{ departmentCode: "asc" }],
      select: {
        id: true,
        companyId: true,
        departmentCode: true,
        name: true,
        type: true,
        status: true
      }
    }),
    prisma.sku.findMany({
      orderBy: [{ skuCode: "asc" }],
      select: {
        id: true,
        skuCode: true,
        name: true,
        spec: true,
        modelNo: true,
        material: true,
        unit: true,
        category: true,
        purchaseReferencePrice: true,
        salesReferencePrice: true,
        referenceCurrency: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.customer.findMany({
      orderBy: [{ customerCode: "asc" }],
      select: {
        id: true,
        customerCode: true,
        name: true,
        country: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxNo: true,
        bankName: true,
        bankAccountNo: true,
        bankAddress: true,
        cooperationCompanyId: true,
        cooperationCompanyName: true,
        customerType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.supplier.findMany({
      orderBy: [{ supplierCode: "asc" }],
      select: {
        id: true,
        supplierCode: true,
        name: true,
        country: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        taxNo: true,
        bankName: true,
        bankAccountNo: true,
        bankAddress: true,
        cooperationCompanyId: true,
        cooperationCompanyName: true,
        supplierType: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.user.findMany({
      orderBy: [{ username: "asc" }],
      select: {
        id: true,
        username: true,
        employeeNo: true,
        displayName: true,
        email: true,
        phone: true,
        role: true,
        position: true,
        status: true,
        companyId: true,
        departmentId: true,
        workCountry: true,
        responsibilityScope: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.vehicle.findMany({
      orderBy: [{ vehicleCode: "asc" }, { plateNo: "asc" }],
      select: {
        id: true,
        vehicleCode: true,
        vehicleQrCode: true,
        plateNo: true,
        companyId: true,
        ownershipCompanyId: true,
        vehicleType: true,
        driverId: true,
        driverName: true,
        maintenanceNote: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.driver.findMany({
      orderBy: [{ driverCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        driverCode: true,
        employeeNo: true,
        name: true,
        phone: true,
        companyId: true,
        licenseNo: true,
        workCountry: true,
        rewardPenaltyNotes: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  ]);

  const companyById = new Map(companies.map((item) => [item.id, item]));
  const departmentById = new Map(departments.map((item) => [item.id, item]));
  const driverById = new Map(drivers.map((item) => [item.id, item]));
  const vehicleByDriverId = new Map<string, (typeof vehicles)[number]>();

  for (const vehicle of vehicles) {
    if (vehicle.driverId && !vehicleByDriverId.has(vehicle.driverId)) {
      vehicleByDriverId.set(vehicle.driverId, vehicle);
    }
  }

  const customerRecords = customers.map((item) => ({
    ...item,
    statusMeta: mapStatus(item.status),
    contactSummary: compactContact(item),
    cooperationCompanyName: item.cooperationCompanyName ?? companyById.get(item.cooperationCompanyId ?? "")?.name ?? null,
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt)
  }));

  const supplierRecords = suppliers.map((item) => ({
    ...item,
    statusMeta: mapStatus(item.status),
    contactSummary: compactContact(item),
    cooperationCompanyName: item.cooperationCompanyName ?? companyById.get(item.cooperationCompanyId ?? "")?.name ?? null,
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt)
  }));

  const userRecords = users.map((item) => {
    const company = companyById.get(item.companyId ?? "");
    const department = departmentById.get(item.departmentId ?? "");

    return {
      ...item,
      statusMeta: mapStatus(item.status),
      companyName: company?.name ?? null,
      companyCode: company?.companyCode ?? null,
      departmentName: department?.name ?? null,
      departmentCode: department?.departmentCode ?? null,
      contactSummary: [item.phone, item.email].filter(Boolean).join(" / ") || "-",
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt)
    };
  });

  const vehicleRecords = vehicles.map((item) => {
    const company = companyById.get(item.companyId ?? "");
    const ownershipCompany = companyById.get(item.ownershipCompanyId ?? "");
    const driver = item.driverId ? driverById.get(item.driverId) : null;

    return {
      ...item,
      statusMeta: mapStatus(item.status),
      companyName: company?.name ?? null,
      ownershipCompanyName: ownershipCompany?.name ?? null,
      driverCode: driver?.driverCode ?? null,
      driverName: item.driverName ?? driver?.name ?? null,
      driverPhone: driver?.phone ?? null,
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt)
    };
  });

  const driverRecords = drivers.map((item) => {
    const company = companyById.get(item.companyId ?? "");
    const boundVehicle = vehicleByDriverId.get(item.id);

    return {
      ...item,
      statusMeta: mapStatus(item.status),
      companyName: company?.name ?? null,
      companyCode: company?.companyCode ?? null,
      boundVehicleId: boundVehicle?.id ?? null,
      boundVehicleCode: boundVehicle?.vehicleCode ?? null,
      boundPlateNo: boundVehicle?.plateNo ?? null,
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt)
    };
  });

  const skuRecords = skus.map((item) => ({
    ...item,
    statusMeta: mapStatus(item.status),
    referencePriceLabel:
      typeof item.purchaseReferencePrice === "number" || typeof item.salesReferencePrice === "number"
        ? `采购 ${item.purchaseReferencePrice ?? "-"} / 销售 ${item.salesReferencePrice ?? "-"} ${item.referenceCurrency}`
        : "-",
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt)
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      skus: skuRecords.length,
      activeSkus: skuRecords.filter((item) => item.status === "ACTIVE").length,
      customers: customerRecords.length,
      suppliers: supplierRecords.length,
      users: userRecords.length,
      drivers: driverRecords.length,
      vehicles: vehicleRecords.length,
      boundVehicles: vehicleRecords.filter((item) => Boolean(item.driverId)).length,
      companies: companies.length,
      departments: departments.length
    },
    narrative: {
      role:
        "基础主数据是 Demo 2.0 的底座，后续合同、采购、仓储、销售、财务和权限都应引用这里的统一编码。",
      boundary:
        "当前第一版先做统一台账、字段补齐、状态启停和责任追溯展示，不做复杂审批和完整主数据治理流程。",
      next:
        "后续阶段会继续把合同、单据、仓储、物流、销售、财务逐步改成更强的主数据引用。"
    },
    records: {
      skus: skuRecords,
      customers: customerRecords,
      suppliers: supplierRecords,
      users: userRecords,
      vehicles: vehicleRecords,
      drivers: driverRecords,
      companies: companies.map((item) => ({
        ...item,
        statusMeta: mapStatus(item.status)
      })),
      departments: departments.map((item) => ({
        ...item,
        companyName: companyById.get(item.companyId ?? "")?.name ?? null,
        statusMeta: mapStatus(item.status)
      }))
    }
  };
}

masterDataRouter.get("/overview", async (_request, response) => {
  response.json(await buildMasterDataOverview());
});

masterDataRouter.patch("/:domain/:id/status", async (request, response) => {
  const domain = request.params.domain as MasterDataDomain;
  const id = request.params.id;
  const status = typeof request.body?.status === "string" ? request.body.status.trim().toUpperCase() : "";

  if (!["skus", "customers", "suppliers", "users", "vehicles", "drivers"].includes(domain)) {
    response.status(404).json({ message: "不支持的主数据类型。" });
    return;
  }

  if (!allowedStatuses.has(status)) {
    response.status(400).json({ message: "状态只能是 ACTIVE、INACTIVE、SUSPENDED 或 MAINTENANCE。" });
    return;
  }

  if (status === "MAINTENANCE" && domain !== "vehicles") {
    response.status(400).json({ message: "只有车辆主数据允许设置为维护中。" });
    return;
  }

  const actor = await getActor();

  try {
    let beforeStatus: string | null | undefined;

    switch (domain) {
      case "skus": {
        const current = await prisma.sku.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "SKU 主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.sku.update({ where: { id }, data: { status } });
        break;
      }
      case "customers": {
        const current = await prisma.customer.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "客户主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.customer.update({ where: { id }, data: { status } });
        break;
      }
      case "suppliers": {
        const current = await prisma.supplier.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "供应商主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.supplier.update({ where: { id }, data: { status } });
        break;
      }
      case "users": {
        const current = await prisma.user.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "人员主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.user.update({ where: { id }, data: { status } });
        break;
      }
      case "vehicles": {
        const current = await prisma.vehicle.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "车辆主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.vehicle.update({ where: { id }, data: { status } });
        break;
      }
      case "drivers": {
        const current = await prisma.driver.findUnique({ where: { id }, select: { status: true } });
        if (!current) {
          response.status(404).json({ message: "司机主数据不存在。" });
          return;
        }
        beforeStatus = current.status;
        await prisma.driver.update({ where: { id }, data: { status } });
        break;
      }
      default:
        response.status(404).json({ message: "不支持的主数据类型。" });
        return;
    }

    await writeMasterDataAudit({
      userId: actor.userId,
      username: actor.username,
      domain,
      entityId: id,
      beforeStatus,
      afterStatus: status
    });

    response.json({
      ok: true,
      domain,
      id,
      status,
      statusMeta: mapStatus(status)
    });
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "更新主数据状态失败。"
    });
  }
});
