import { type Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

const companySelect = {
  id: true,
  companyCode: true,
  name: true,
  country: true,
  companyType: true,
  responsibilities: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CompanySelect;

const departmentSelect = {
  id: true,
  companyId: true,
  departmentCode: true,
  name: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.DepartmentSelect;

type CompanyRecord = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;
type DepartmentRecord = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;
type TagColor = "blue" | "gold" | "green" | "purple" | "cyan";

const companyNarrativeByCode = {
  CN_MAIN: {
    countryLabel: "中国",
    roleSummary: "负责采购下单、供应商协同与境内集货，是整条国际贸易链路的前端启动主体。",
    coreFunctions: ["采购下单", "供应商发货跟进", "境内集货", "国际运输前准备"],
    coveredModules: ["/documents", "/procurement", "/logistics"],
    operatingHighlights: [
      "承接合同与箱单确认后的采购执行",
      "负责国内集货完成并推动进入国际物流",
      "适合作为集团境内采购与操作中心"
    ],
    tagColor: "blue" as TagColor
  },
  HK_SETTLEMENT: {
    countryLabel: "中国香港",
    roleSummary: "负责资金、结算与财务跟进，是演示版多主体资金中枢。",
    coreFunctions: ["资金结算", "回款跟进", "财务协同"],
    coveredModules: ["/finance", "/costs"],
    operatingHighlights: [
      "承接应收、回款、核销等财务动作",
      "适合作为跨境资金结算中心",
      "当前 Demo Owner 默认挂靠该主体"
    ],
    tagColor: "gold" as TagColor
  },
  SG_SETTLEMENT: {
    countryLabel: "新加坡",
    roleSummary: "作为第二结算主体，用于演示多结算中心架构与海外资金路线扩展能力。",
    coreFunctions: ["海外结算预留", "跨国资金路由", "备用结算中心"],
    coveredModules: ["/finance", "/companies"],
    operatingHighlights: [
      "当前第一版不承载真实业务写入，只做组织能力展示",
      "适合演示未来多币种、多账户、多法域扩展",
      "后续可承接区域性清算或海外收付款"
    ],
    tagColor: "cyan" as TagColor
  },
  ZM_OPERATIONS: {
    countryLabel: "赞比亚",
    roleSummary: "负责目的国销售、仓储、清关与本地物流，是当前默认演示场景的主要海外运营主体。",
    coreFunctions: ["清关执行", "仓储管理", "销售配送", "本地物流"],
    coveredModules: ["/customs", "/warehouse", "/sales", "/qr-items"],
    operatingHighlights: [
      "承接到港后的清关、预收货、扫码收发货",
      "负责销售单、配送单与二维码库存链路",
      "是当前默认演示主链路的核心海外执行主体"
    ],
    tagColor: "green" as TagColor
  },
  CD_OPERATIONS: {
    countryLabel: "刚果金",
    roleSummary: "作为第二海外运营主体，用于演示跨国家复制运营能力和未来区域扩张。",
    coreFunctions: ["海外运营预留", "仓储与销售复制", "区域扩张展示"],
    coveredModules: ["/companies", "/warehouse", "/sales"],
    operatingHighlights: [
      "当前第一版主要用于组织结构展示",
      "适合作为未来第二目的国复制模板",
      "正式版可扩展为独立库存、销售、清关权限边界"
    ],
    tagColor: "purple" as TagColor
  }
} as const;

const routeTitleByPath: Record<string, string> = {
  "/documents": "合同与单据",
  "/procurement": "采购与集货",
  "/logistics": "国际物流",
  "/customs": "报关清关",
  "/warehouse": "仓储管理",
  "/sales": "销售与配送",
  "/finance": "财务回款",
  "/costs": "成本利润",
  "/companies": "多公司主体",
  "/qr-items": "二维码追溯"
};

export const companiesRouter = Router();

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeCompanyType(type: string | null | undefined) {
  if (type === "SETTLEMENT") {
    return {
      code: "SETTLEMENT",
      label: "结算主体",
      color: "gold" as TagColor
    };
  }

  return {
    code: type ?? "OPERATING",
    label: "经营主体",
    color: "blue" as TagColor
  };
}

function buildPermissionBoundary(company: CompanyRecord) {
  const narrative = companyNarrativeByCode[company.companyCode as keyof typeof companyNarrativeByCode];

  return {
    currentDemo:
      "当前 Demo 版只展示组织结构与职责分工，不做真实权限隔离，也不做跨主体审批链。",
    futureTarget: "正式版会按公司、国家、岗位进行权限隔离。",
    scopeSuggestions:
      company.companyCode === "SG_SETTLEMENT"
        ? undefined
        : "未来应至少按主体、部门、岗位、国家与业务对象做菜单、数据、单据与操作权限隔离。"
  };
}

function buildRouteTags(paths: readonly string[]) {
  return paths.map((path) => ({
    path,
    title: routeTitleByPath[path] ?? path
  }));
}

function buildDepartmentTags(departments: DepartmentRecord[]) {
  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.departmentCode,
    type: department.type ?? "GENERAL",
    status: department.status
  }));
}

async function buildOrganizationView(companies: CompanyRecord[]) {
  const companyIds = companies.map((item) => item.id);

  const [departments, users, contracts, purchaseOrders, shipments, customsClearances, salesOrders, warehouses] =
    await Promise.all([
      prisma.department.findMany({
        where: { companyId: { in: companyIds } },
        orderBy: [{ createdAt: "asc" }],
        select: departmentSelect
      }),
      prisma.user.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          companyId: true,
          departmentId: true,
          status: true
        }
      }),
      prisma.contract.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          contractNo: true,
          companyId: true,
          customerName: true,
          amount: true,
          currency: true
        }
      }),
      prisma.purchaseOrder.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          purchaseNo: true,
          companyId: true,
          supplierName: true,
          quantity: true,
          unit: true,
          status: true
        }
      }),
      prisma.shipment.findMany({
        select: {
          id: true,
          shipmentNo: true,
          contractId: true,
          status: true
        }
      }),
      prisma.customsClearance.findMany({
        select: {
          id: true,
          clearanceNo: true,
          responsibleCompany: true,
          status: true
        }
      }),
      prisma.salesOrder.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          salesNo: true,
          companyId: true,
          customerName: true,
          amount: true,
          currency: true,
          status: true
        }
      }),
      prisma.warehouse.findMany({
        select: {
          id: true,
          name: true,
          country: true,
          status: true
        }
      })
    ]);

  const departmentsByCompanyId = new Map<string, DepartmentRecord[]>();
  for (const department of departments) {
    if (!department.companyId) {
      continue;
    }

    const items = departmentsByCompanyId.get(department.companyId) ?? [];
    items.push(department);
    departmentsByCompanyId.set(department.companyId, items);
  }

  const usersByCompanyId = new Map<string, typeof users>();
  for (const user of users) {
    if (!user.companyId) {
      continue;
    }

    const items = usersByCompanyId.get(user.companyId) ?? [];
    items.push(user);
    usersByCompanyId.set(user.companyId, items);
  }

  const contractsByCompanyId = new Map<string, typeof contracts>();
  const contractById = new Map<string, (typeof contracts)[number]>();
  for (const item of contracts) {
    contractById.set(item.id, item);

    if (!item.companyId) {
      continue;
    }

    const items = contractsByCompanyId.get(item.companyId) ?? [];
    items.push(item);
    contractsByCompanyId.set(item.companyId, items);
  }

  const purchaseOrdersByCompanyId = new Map<string, typeof purchaseOrders>();
  for (const item of purchaseOrders) {
    if (!item.companyId) {
      continue;
    }

    const items = purchaseOrdersByCompanyId.get(item.companyId) ?? [];
    items.push(item);
    purchaseOrdersByCompanyId.set(item.companyId, items);
  }

  const salesOrdersByCompanyId = new Map<string, typeof salesOrders>();
  for (const item of salesOrders) {
    if (!item.companyId) {
      continue;
    }

    const items = salesOrdersByCompanyId.get(item.companyId) ?? [];
    items.push(item);
    salesOrdersByCompanyId.set(item.companyId, items);
  }

  const customsByCompanyName = new Map<string, typeof customsClearances>();
  for (const item of customsClearances) {
    if (!item.responsibleCompany) {
      continue;
    }

    const items = customsByCompanyName.get(item.responsibleCompany) ?? [];
    items.push(item);
    customsByCompanyName.set(item.responsibleCompany, items);
  }

  return companies.map((company) => {
    const narrative = companyNarrativeByCode[company.companyCode as keyof typeof companyNarrativeByCode];
    const linkedDepartments = departmentsByCompanyId.get(company.id) ?? [];
    const linkedUsers = usersByCompanyId.get(company.id) ?? [];
    const linkedContracts = contractsByCompanyId.get(company.id) ?? [];
    const linkedPurchaseOrders = purchaseOrdersByCompanyId.get(company.id) ?? [];
    const linkedSalesOrders = salesOrdersByCompanyId.get(company.id) ?? [];
    const linkedShipments = shipments.filter((item) => {
      if (!item.contractId) {
        return false;
      }

      return contractById.get(item.contractId)?.companyId === company.id;
    });
    const linkedCustoms = customsByCompanyName.get(company.name) ?? [];
    const relatedWarehouse = warehouses.find((item) => item.country === company.country) ?? null;
    const companyTypeMeta = normalizeCompanyType(company.companyType);

    return {
      id: company.id,
      companyCode: company.companyCode,
      name: company.name,
      country: company.country,
      countryLabel: narrative?.countryLabel ?? company.country,
      companyType: company.companyType,
      companyTypeMeta,
      responsibilities: company.responsibilities ?? "",
      status: company.status,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      roleSummary: narrative?.roleSummary ?? "用于承接多主体组织展示。",
      coreFunctions: narrative?.coreFunctions ?? [],
      coveredModules: buildRouteTags(narrative?.coveredModules ?? []),
      operatingHighlights: narrative?.operatingHighlights ?? [],
      tagColor: narrative?.tagColor ?? companyTypeMeta.color,
      departments: buildDepartmentTags(linkedDepartments),
      users: linkedUsers.map((item) => ({
        id: item.id,
        username: item.username,
        displayName: item.displayName,
        role: item.role,
        status: item.status
      })),
      businessSnapshot: {
        contracts: linkedContracts.length,
        purchaseOrders: linkedPurchaseOrders.length,
        shipments: linkedShipments.length,
        customs: linkedCustoms.length,
        salesOrders: linkedSalesOrders.length,
        warehouses: relatedWarehouse ? 1 : 0
      },
      referenceRecords: {
        latestContract: linkedContracts[0]
          ? {
              contractNo: linkedContracts[0].contractNo,
              customerName: linkedContracts[0].customerName,
              amount: linkedContracts[0].amount,
              currency: linkedContracts[0].currency
            }
          : null,
        latestPurchaseOrder: linkedPurchaseOrders[0]
          ? {
              purchaseNo: linkedPurchaseOrders[0].purchaseNo,
              supplierName: linkedPurchaseOrders[0].supplierName,
              quantity: linkedPurchaseOrders[0].quantity,
              unit: linkedPurchaseOrders[0].unit,
              status: linkedPurchaseOrders[0].status
            }
          : null,
        latestSalesOrder: linkedSalesOrders[0]
          ? {
              salesNo: linkedSalesOrders[0].salesNo,
              customerName: linkedSalesOrders[0].customerName,
              amount: linkedSalesOrders[0].amount,
              currency: linkedSalesOrders[0].currency,
              status: linkedSalesOrders[0].status
            }
          : null,
        warehouse: relatedWarehouse
          ? {
              name: relatedWarehouse.name,
              country: relatedWarehouse.country,
              status: relatedWarehouse.status
            }
          : null
      },
      permissionBoundary: buildPermissionBoundary(company)
    };
  });
}

companiesRouter.get("/organization", async (_request, response) => {
  const companies = await prisma.company.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: companySelect
  });

  const records = await buildOrganizationView(companies);

  response.json({
    summary: {
      totalCompanies: records.length,
      operatingCompanies: records.filter((item) => item.companyTypeMeta.code !== "SETTLEMENT").length,
      settlementCompanies: records.filter((item) => item.companyTypeMeta.code === "SETTLEMENT").length,
      departments: records.reduce((sum, item) => sum + item.departments.length, 0),
      demoUsers: records.reduce((sum, item) => sum + item.users.length, 0)
    },
    architectureNarrative: {
      goal: "通过多主体组织结构展示，让甲方看到系统不仅能做库存扫码，也能承接国际贸易集团化运营形态。",
      currentBoundary: "当前 Demo 版只展示组织结构和职责分工，不做真实权限隔离。",
      futureTarget: "正式版会按公司、国家、岗位进行权限隔离。"
    },
    records
  });
});

companiesRouter.get("/organization/:id", async (request, response) => {
  const company = await prisma.company.findUnique({
    where: { id: request.params.id },
    select: companySelect
  });

  if (!company) {
    response.status(404).json({ message: "Company not found." });
    return;
  }

  const [detail] = await buildOrganizationView([company]);

  response.json(detail);
});
