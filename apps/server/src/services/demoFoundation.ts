import fs from "node:fs/promises";
import path from "node:path";
import {
  AiTaskStatus,
  AiTaskType,
  BatchStatus,
  ContractStatus,
  DocumentAiStatus,
  DocumentStatus,
  DocumentType,
  PaymentStatus,
  QrItemStatus,
  StockMovementType,
  SystemUserRole,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import { demoScenarioConfig, type DemoScenarioConfig } from "../config/demoScenario";
import { documentsUploadDir } from "../config/paths";

type DbClient = Prisma.TransactionClient | PrismaClient;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;
const PALLET_SIZE = 10;

const companySeeds = [
  {
    companyCode: "CN_MAIN",
    name: "境内公司",
    country: "China",
    companyType: "OPERATING",
    responsibilities: "采购、境内集货"
  },
  {
    companyCode: "HK_SETTLEMENT",
    name: "香港公司",
    country: "Hong Kong SAR",
    companyType: "SETTLEMENT",
    responsibilities: "资金、结算"
  },
  {
    companyCode: "SG_SETTLEMENT",
    name: "新加坡公司",
    country: "Singapore",
    companyType: "SETTLEMENT",
    responsibilities: "资金、结算"
  },
  {
    companyCode: "ZM_OPERATIONS",
    name: "赞比亚公司",
    country: "Zambia",
    companyType: "OPERATING",
    responsibilities: "销售、仓储、清关、物流"
  },
  {
    companyCode: "CD_OPERATIONS",
    name: "刚果金公司",
    country: "Democratic Republic of the Congo",
    companyType: "OPERATING",
    responsibilities: "销售、仓储、清关、物流"
  }
] as const;

const roleSeeds = [
  {
    roleCode: "OWNER",
    roleName: "系统负责人",
    description: "Demo 总负责人"
  },
  {
    roleCode: "ADMIN",
    roleName: "系统管理员",
    description: "负责后台管理与配置"
  },
  {
    roleCode: "WAREHOUSE",
    roleName: "仓储操作员",
    description: "负责扫码入库和出库"
  },
  {
    roleCode: "FINANCE",
    roleName: "财务专员",
    description: "负责回款与核销跟进"
  }
] as const;

export const standardScenarioIdentifiers = {
  contractNo: "CTR-DEMO-202606-001",
  batchNo: "BAT-DEMO-202606-001",
  purchaseNo: "PO-DEMO-202606-001",
  shipmentNo: "SHP-DEMO-202606-001",
  billOfLadingNo: "BL-DEMO-202606-001",
  containerNo: "CONT-DEMO-202606-001",
  clearanceNo: "CUS-DEMO-202606-001",
  preReceiveNo: "PR-DEMO-202606-001",
  inboundNo: "IN-DEMO-202606-001",
  salesNo: "SO-DEMO-202606-001",
  outboundNo: "OUT-DEMO-202606-001",
  deliveryNo: "DO-DEMO-202606-001",
  invoiceNo: "INV-DEMO-202606-001",
  receivableWorkOrderNo: "WO-FIN-DEMO-202606-001",
  logisticsWorkOrderNo: "WO-LOG-DEMO-202606-001",
  customsWorkOrderNo: "WO-CUS-DEMO-202606-001",
  warehouseWorkOrderNo: "WO-WH-DEMO-202606-001",
  supplierWorkOrderNo: "WO-PROC-DEMO-202606-001"
} as const;

type DemoFoundationResult = {
  companies: Map<string, string>;
  departmentIds: Map<string, string>;
  roleIds: Map<string, string>;
  demoUser: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    role: SystemUserRole;
    status: string;
    companyId: string | null;
    departmentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  demoSku: {
    id: string;
    skuCode: string;
    name: string;
    unit: string;
  };
  demoCustomer: {
    id: string;
    name: string;
  };
  demoSupplier: {
    id: string;
    name: string;
  };
  demoWarehouse: {
    id: string;
    warehouseCode: string;
    name: string;
    country: string;
    city: string | null;
    address: string | null;
    companyId: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  demoLocation: {
    id: string;
    locationCode: string;
    zone: string | null;
    capacity: number | null;
    status: string;
    warehouseId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  demoConfig: {
    id: string;
    scenarioName: string;
    origin: string;
    destinationWarehouse: string;
    customerName: string;
    supplierName: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    plannedOutboundQuantity: number;
    amount: number;
    currency: string;
    customerId: string | null;
    supplierId: string | null;
    skuId: string | null;
    warehouseId: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

type StandardScenarioDocumentSeed = {
  key: "contract" | "packingList" | "invoice" | "billOfLading";
  documentType: DocumentType;
  fileName: string;
  originalName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  content: string;
  extractedJson: Prisma.JsonObject;
  relatedEntityType: string;
  createdAt: Date;
};

type StandardScenarioResult = {
  created: boolean;
  identifiers: typeof standardScenarioIdentifiers;
  contractId: string;
  batchId: string;
};

function addTime(base: Date, offsetMs: number) {
  return new Date(base.getTime() + offsetMs);
}

function buildDocumentStoragePath(fileName: string) {
  const filePath = path.posix.join("uploads", "documents", fileName);

  return {
    filePath,
    fileUrl: `/${filePath}`
  };
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

function toJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;
}

function buildStandardScenarioNumbers(config: DemoScenarioConfig = demoScenarioConfig) {
  const unitPrice = Number((config.amount / config.totalQuantity).toFixed(2));
  const outboundAmount = Number((unitPrice * config.plannedOutboundQuantity).toFixed(2));

  return {
    unitPrice,
    outboundAmount,
    remainingQuantity: Math.max(config.totalQuantity - config.plannedOutboundQuantity, 0)
  };
}

function buildStandardScenarioDocuments(
  config: DemoScenarioConfig,
  createdAtBase: Date
): StandardScenarioDocumentSeed[] {
  const numbers = buildStandardScenarioNumbers(config);
  const commonExtraction = {
    contractNoDraft: standardScenarioIdentifiers.contractNo,
    batchNoDraft: standardScenarioIdentifiers.batchNo,
    productName: config.productName,
    customerName: config.customerName,
    supplierName: config.supplierName,
    destinationWarehouse: config.destinationWarehouse,
    totalQuantity: config.totalQuantity,
    unit: config.unit,
    amount: config.amount,
    currency: config.currency
  };

  const contractFile = buildDocumentStoragePath("demo-contract-ctr-demo-202606-001.txt");
  const packingListFile = buildDocumentStoragePath("demo-packing-list-bat-demo-202606-001.txt");
  const invoiceFile = buildDocumentStoragePath("demo-invoice-inv-demo-202606-001.txt");
  const billOfLadingFile = buildDocumentStoragePath("demo-bol-shp-demo-202606-001.txt");

  return [
    {
      key: "contract",
      documentType: DocumentType.CONTRACT,
      fileName: "demo-contract-ctr-demo-202606-001.txt",
      originalName: "演示合同-中国采购100箱.txt",
      filePath: contractFile.filePath,
      fileUrl: contractFile.fileUrl,
      mimeType: "text/plain",
      relatedEntityType: "Contract",
      createdAt: addTime(createdAtBase, 0),
      content: [
        "国际贸易演示合同",
        `合同号: ${standardScenarioIdentifiers.contractNo}`,
        `供应商: ${config.supplierName}`,
        `客户: ${config.customerName}`,
        `商品名称: ${config.productName}`,
        `数量: ${config.totalQuantity}${config.unit}`,
        `目的仓库: ${config.destinationWarehouse}`,
        `合同金额: ${config.amount} ${config.currency}`,
        "备注: 该文件用于恢复标准演示订单链路。"
      ].join("\n"),
      extractedJson: toJsonObject({
        ...commonExtraction,
        source: "standard-demo-seed",
        documentType: DocumentType.CONTRACT,
        notes: [
          "标准演示合同文件。",
          "重置演示环境后会自动恢复这份合同草稿识别结果。"
        ]
      })
    },
    {
      key: "packingList",
      documentType: DocumentType.PACKING_LIST,
      fileName: "demo-packing-list-bat-demo-202606-001.txt",
      originalName: "演示箱单-赞比亚仓库100箱.txt",
      filePath: packingListFile.filePath,
      fileUrl: packingListFile.fileUrl,
      mimeType: "text/plain",
      relatedEntityType: "Batch",
      createdAt: addTime(createdAtBase, 30 * 60 * 1000),
      content: [
        "国际贸易演示箱单",
        `关联合同号: ${standardScenarioIdentifiers.contractNo}`,
        `批次号: ${standardScenarioIdentifiers.batchNo}`,
        `商品名称: ${config.productName}`,
        `装箱数量: ${config.totalQuantity}${config.unit}`,
        `目的仓库: ${config.destinationWarehouse}`,
        `建议库位: A-01-01`,
        "备注: 该箱单用于恢复标准批次和二维码追溯数据。"
      ].join("\n"),
      extractedJson: toJsonObject({
        ...commonExtraction,
        source: "standard-demo-seed",
        documentType: DocumentType.PACKING_LIST,
        suggestedLocation: "A-01-01",
        notes: [
          "标准演示箱单文件。",
          "系统会基于这份箱单恢复正式批次与二维码链路。"
        ]
      })
    },
    {
      key: "invoice",
      documentType: DocumentType.INVOICE,
      fileName: "demo-invoice-inv-demo-202606-001.txt",
      originalName: "演示发票-50000USD.txt",
      filePath: invoiceFile.filePath,
      fileUrl: invoiceFile.fileUrl,
      mimeType: "text/plain",
      relatedEntityType: "Receivable",
      createdAt: addTime(createdAtBase, 60 * 60 * 1000),
      content: [
        "国际贸易演示商业发票",
        `发票号: ${standardScenarioIdentifiers.invoiceNo}`,
        `合同号: ${standardScenarioIdentifiers.contractNo}`,
        `商品名称: ${config.productName}`,
        `数量: ${config.totalQuantity}${config.unit}`,
        `单价: ${numbers.unitPrice} ${config.currency}/${config.unit}`,
        `金额: ${config.amount} ${config.currency}`,
        "备注: 该发票用于恢复标准应收演示数据。"
      ].join("\n"),
      extractedJson: toJsonObject({
        ...commonExtraction,
        source: "standard-demo-seed",
        documentType: DocumentType.INVOICE,
        invoiceNoDraft: standardScenarioIdentifiers.invoiceNo,
        unitPrice: numbers.unitPrice,
        notes: [
          "标准演示发票文件。",
          "第一版默认恢复整单应收，后续正式版可扩展为分批确认收入。"
        ]
      })
    },
    {
      key: "billOfLading",
      documentType: DocumentType.BILL_OF_LADING,
      fileName: "demo-bol-shp-demo-202606-001.txt",
      originalName: "演示提单-CONT-DEMO-202606-001.txt",
      filePath: billOfLadingFile.filePath,
      fileUrl: billOfLadingFile.fileUrl,
      mimeType: "text/plain",
      relatedEntityType: "Shipment",
      createdAt: addTime(createdAtBase, 90 * 60 * 1000),
      content: [
        "国际贸易演示提单",
        `提单号: ${standardScenarioIdentifiers.billOfLadingNo}`,
        `运输批次号: ${standardScenarioIdentifiers.shipmentNo}`,
        `柜号: ${standardScenarioIdentifiers.containerNo}`,
        "起运港: Shenzhen Port",
        "目的港: Dar es Salaam Port",
        `关联合同号: ${standardScenarioIdentifiers.contractNo}`,
        `关联批次号: ${standardScenarioIdentifiers.batchNo}`,
        "备注: 该提单用于恢复物流与清关演示数据。"
      ].join("\n"),
      extractedJson: toJsonObject({
        ...commonExtraction,
        source: "standard-demo-seed",
        documentType: DocumentType.BILL_OF_LADING,
        shipmentNoDraft: standardScenarioIdentifiers.shipmentNo,
        billOfLadingNoDraft: standardScenarioIdentifiers.billOfLadingNo,
        containerNoDraft: standardScenarioIdentifiers.containerNo,
        originPort: "Shenzhen Port",
        destinationPort: "Dar es Salaam Port",
        notes: [
          "标准演示提单文件。",
          "清关模块会基于箱单、发票、提单恢复一致性检查结果。"
        ]
      })
    }
  ];
}

async function ensureDemoDocumentFiles(documentSeeds: StandardScenarioDocumentSeed[]) {
  await fs.mkdir(documentsUploadDir, { recursive: true });

  await Promise.all(
    documentSeeds.map((seed) =>
      fs.writeFile(path.join(documentsUploadDir, seed.fileName), seed.content, "utf8")
    )
  );
}

export function buildStandardDemoScenario(config: DemoScenarioConfig = demoScenarioConfig) {
  const expectedRemainingQuantity = Math.max(config.totalQuantity - config.plannedOutboundQuantity, 0);

  return {
    ...config,
    expectedRemainingQuantity,
    storyline: [
      `中国采购 ${config.totalQuantity}${config.unit}货`,
      `发往 ${config.destinationWarehouse}`,
      "上传合同、箱单、发票、提单图片",
      "AI Mock 识别并人工修正",
      "确认后生成正式合同、批次、二维码与后续业务链路"
    ].join(" -> ")
  };
}

export async function ensureDemoFoundation(db: DbClient): Promise<DemoFoundationResult> {
  const companies = new Map<string, string>();

  for (const companySeed of companySeeds) {
    const company = await db.company.upsert({
      where: { companyCode: companySeed.companyCode },
      update: {
        name: companySeed.name,
        country: companySeed.country,
        companyType: companySeed.companyType,
        responsibilities: companySeed.responsibilities,
        status: "ACTIVE"
      },
      create: {
        ...companySeed,
        status: "ACTIVE"
      }
    });

    companies.set(company.companyCode, company.id);
  }

  const departments = [
    {
      departmentCode: "PROCUREMENT",
      name: "采购部",
      type: "PROCUREMENT",
      companyId: companies.get("CN_MAIN") ?? null
    },
    {
      departmentCode: "LOGISTICS",
      name: "物流部",
      type: "LOGISTICS",
      companyId: companies.get("CN_MAIN") ?? null
    },
    {
      departmentCode: "CUSTOMS",
      name: "清关部",
      type: "CUSTOMS",
      companyId: companies.get("ZM_OPERATIONS") ?? null
    },
    {
      departmentCode: "WAREHOUSE",
      name: "仓库部",
      type: "WAREHOUSE",
      companyId: companies.get("ZM_OPERATIONS") ?? null
    },
    {
      departmentCode: "SALES",
      name: "销售部",
      type: "SALES",
      companyId: companies.get("ZM_OPERATIONS") ?? null
    },
    {
      departmentCode: "FINANCE",
      name: "财务部",
      type: "FINANCE",
      companyId: companies.get("HK_SETTLEMENT") ?? null
    }
  ] as const;

  const departmentIds = new Map<string, string>();

  for (const departmentSeed of departments) {
    const department = await db.department.upsert({
      where: { departmentCode: departmentSeed.departmentCode },
      update: {
        name: departmentSeed.name,
        type: departmentSeed.type,
        companyId: departmentSeed.companyId,
        status: "ACTIVE"
      },
      create: {
        departmentCode: departmentSeed.departmentCode,
        name: departmentSeed.name,
        type: departmentSeed.type,
        companyId: departmentSeed.companyId,
        status: "ACTIVE"
      }
    });

    departmentIds.set(department.departmentCode, department.id);
  }

  const demoSku = await db.sku.upsert({
    where: { skuCode: "SKU-DEMO-001" },
    update: {
      name: demoScenarioConfig.productName,
      spec: "Demo Standard",
      modelNo: "CABLE-DEMO-100",
      material: "Copper / PVC",
      unit: demoScenarioConfig.unit,
      category: "Demo Goods",
      purchaseReferencePrice: 300,
      salesReferencePrice: 500,
      referenceCurrency: demoScenarioConfig.currency,
      status: "ACTIVE"
    },
    create: {
      skuCode: "SKU-DEMO-001",
      name: demoScenarioConfig.productName,
      spec: "Demo Standard",
      modelNo: "CABLE-DEMO-100",
      material: "Copper / PVC",
      unit: demoScenarioConfig.unit,
      category: "Demo Goods",
      purchaseReferencePrice: 300,
      salesReferencePrice: 500,
      referenceCurrency: demoScenarioConfig.currency,
      status: "ACTIVE"
    }
  });

  const demoCustomer = await db.customer.upsert({
    where: { customerCode: "CUST-ZM-001" },
    update: {
      name: demoScenarioConfig.customerName,
      country: "Zambia",
      contactName: "Demo Customer Contact",
      phone: "+260-000-000001",
      email: "buyer@abctrading.example",
      address: "Lusaka, Zambia",
      taxNo: "ZM-TAX-DEMO-001",
      bankName: "Zambia Demo Bank",
      bankAccountNo: "ZM-DEMO-ACCOUNT-001",
      bankAddress: "Lusaka Main Branch",
      cooperationCompanyId: companies.get("ZM_OPERATIONS") ?? null,
      cooperationCompanyName: "赞比亚公司",
      customerType: "OVERSEAS_CUSTOMER",
      status: "ACTIVE"
    },
    create: {
      customerCode: "CUST-ZM-001",
      name: demoScenarioConfig.customerName,
      country: "Zambia",
      contactName: "Demo Customer Contact",
      phone: "+260-000-000001",
      email: "buyer@abctrading.example",
      address: "Lusaka, Zambia",
      taxNo: "ZM-TAX-DEMO-001",
      bankName: "Zambia Demo Bank",
      bankAccountNo: "ZM-DEMO-ACCOUNT-001",
      bankAddress: "Lusaka Main Branch",
      cooperationCompanyId: companies.get("ZM_OPERATIONS") ?? null,
      cooperationCompanyName: "赞比亚公司",
      customerType: "OVERSEAS_CUSTOMER",
      status: "ACTIVE"
    }
  });

  const demoSupplier = await db.supplier.upsert({
    where: { supplierCode: "SUP-CN-001" },
    update: {
      name: demoScenarioConfig.supplierName,
      country: "China",
      contactName: "Demo Supplier Contact",
      phone: "+86-000-0000001",
      email: "sales@china-supplier.example",
      address: "Shenzhen, China",
      taxNo: "CN-TAX-DEMO-001",
      bankName: "China Demo Bank",
      bankAccountNo: "CN-DEMO-ACCOUNT-001",
      bankAddress: "Shenzhen Demo Branch",
      cooperationCompanyId: companies.get("CN_MAIN") ?? null,
      cooperationCompanyName: "境内公司",
      supplierType: "DOMESTIC_SUPPLIER",
      status: "ACTIVE"
    },
    create: {
      supplierCode: "SUP-CN-001",
      name: demoScenarioConfig.supplierName,
      country: "China",
      contactName: "Demo Supplier Contact",
      phone: "+86-000-0000001",
      email: "sales@china-supplier.example",
      address: "Shenzhen, China",
      taxNo: "CN-TAX-DEMO-001",
      bankName: "China Demo Bank",
      bankAccountNo: "CN-DEMO-ACCOUNT-001",
      bankAddress: "Shenzhen Demo Branch",
      cooperationCompanyId: companies.get("CN_MAIN") ?? null,
      cooperationCompanyName: "境内公司",
      supplierType: "DOMESTIC_SUPPLIER",
      status: "ACTIVE"
    }
  });

  const demoWarehouse = await db.warehouse.upsert({
    where: { warehouseCode: "WH-ZM-001" },
    update: {
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      name: demoScenarioConfig.destinationWarehouse,
      country: "Zambia",
      city: "Lusaka",
      address: "Zambia Demo Warehouse Park",
      status: "ACTIVE"
    },
    create: {
      warehouseCode: "WH-ZM-001",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      name: demoScenarioConfig.destinationWarehouse,
      country: "Zambia",
      city: "Lusaka",
      address: "Zambia Demo Warehouse Park",
      status: "ACTIVE"
    }
  });

  const demoLocation = await db.warehouseLocation.upsert({
    where: { locationCode: "A-01-01" },
    update: {
      warehouseId: demoWarehouse.id,
      zone: "A",
      capacity: demoScenarioConfig.totalQuantity,
      status: "ACTIVE"
    },
    create: {
      warehouseId: demoWarehouse.id,
      locationCode: "A-01-01",
      zone: "A",
      capacity: demoScenarioConfig.totalQuantity,
      status: "ACTIVE"
    }
  });

  const roleIds = new Map<string, string>();

  for (const roleSeed of roleSeeds) {
    const role = await db.role.upsert({
      where: { roleCode: roleSeed.roleCode },
      update: {
        roleName: roleSeed.roleName,
        description: roleSeed.description,
        status: "ACTIVE"
      },
      create: {
        ...roleSeed,
        status: "ACTIVE"
      }
    });

    roleIds.set(role.roleCode, role.id);
  }

  const demoUser = await db.user.upsert({
    where: { username: "demo-owner" },
    update: {
      employeeNo: "EMP-HK-OWNER-001",
      displayName: "Demo Owner",
      email: "owner@trade-ai-demo.local",
      phone: "+852-0000-0001",
      role: SystemUserRole.OWNER,
      position: "集团演示负责人",
      status: "ACTIVE",
      companyId: companies.get("HK_SETTLEMENT") ?? null,
      departmentId: departmentIds.get("FINANCE") ?? null,
      workCountry: "Hong Kong SAR",
      responsibilityScope: "拥有演示环境最高权限，负责重置演示数据、财务视角和整体流程验收。"
    },
    create: {
      username: "demo-owner",
      employeeNo: "EMP-HK-OWNER-001",
      displayName: "Demo Owner",
      email: "owner@trade-ai-demo.local",
      phone: "+852-0000-0001",
      role: SystemUserRole.OWNER,
      position: "集团演示负责人",
      status: "ACTIVE",
      companyId: companies.get("HK_SETTLEMENT") ?? null,
      departmentId: departmentIds.get("FINANCE") ?? null,
      workCountry: "Hong Kong SAR",
      responsibilityScope: "拥有演示环境最高权限，负责重置演示数据、财务视角和整体流程验收。"
    }
  });

  const operatorUserSeeds = [
    {
      username: "procurement-operator",
      employeeNo: "EMP-CN-PROC-001",
      displayName: "采购操作员",
      email: "procurement@trade-ai-demo.local",
      phone: "+86-000-0000002",
      role: SystemUserRole.ADMIN,
      position: "采购专员",
      companyId: companies.get("CN_MAIN") ?? null,
      departmentId: departmentIds.get("PROCUREMENT") ?? null,
      workCountry: "China",
      responsibilityScope: "负责供应商跟进、采购下单和国内集货前置资料维护。"
    },
    {
      username: "warehouse-operator",
      employeeNo: "EMP-ZM-WH-001",
      displayName: "仓库操作员",
      email: "warehouse@trade-ai-demo.local",
      phone: "+260-000-000002",
      role: SystemUserRole.WAREHOUSE,
      position: "仓储主管",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      departmentId: departmentIds.get("WAREHOUSE") ?? null,
      workCountry: "Zambia",
      responsibilityScope: "负责预收货、扫码入库、扫码出库和库存异常记录。"
    },
    {
      username: "customs-operator",
      employeeNo: "EMP-ZM-CUS-001",
      displayName: "清关操作员",
      email: "customs@trade-ai-demo.local",
      phone: "+260-000-000003",
      role: SystemUserRole.ADMIN,
      position: "清关专员",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      departmentId: departmentIds.get("CUSTOMS") ?? null,
      workCountry: "Zambia",
      responsibilityScope: "负责清关资料包、单据一致性检查和清关任务跟进。"
    },
    {
      username: "sales-operator",
      employeeNo: "EMP-ZM-SALES-001",
      displayName: "销售配送员",
      email: "sales@trade-ai-demo.local",
      phone: "+260-000-000004",
      role: SystemUserRole.ADMIN,
      position: "销售配送专员",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      departmentId: departmentIds.get("SALES") ?? null,
      workCountry: "Zambia",
      responsibilityScope: "负责销售单、配送任务、客户签收和售后前置沟通。"
    },
    {
      username: "finance-operator",
      employeeNo: "EMP-HK-FIN-001",
      displayName: "财务回款员",
      email: "finance@trade-ai-demo.local",
      phone: "+852-0000-0002",
      role: SystemUserRole.FINANCE,
      position: "财务专员",
      companyId: companies.get("HK_SETTLEMENT") ?? null,
      departmentId: departmentIds.get("FINANCE") ?? null,
      workCountry: "Hong Kong SAR",
      responsibilityScope: "负责应收、回款、核销和逾期催收跟进。"
    }
  ];

  for (const userSeed of operatorUserSeeds) {
    await db.user.upsert({
      where: { username: userSeed.username },
      update: {
        employeeNo: userSeed.employeeNo,
        displayName: userSeed.displayName,
        email: userSeed.email,
        phone: userSeed.phone,
        role: userSeed.role,
        position: userSeed.position,
        companyId: userSeed.companyId,
        departmentId: userSeed.departmentId,
        workCountry: userSeed.workCountry,
        responsibilityScope: userSeed.responsibilityScope,
        status: "ACTIVE"
      },
      create: {
        username: userSeed.username,
        employeeNo: userSeed.employeeNo,
        displayName: userSeed.displayName,
        email: userSeed.email,
        phone: userSeed.phone,
        role: userSeed.role,
        position: userSeed.position,
        companyId: userSeed.companyId,
        departmentId: userSeed.departmentId,
        workCountry: userSeed.workCountry,
        responsibilityScope: userSeed.responsibilityScope,
        status: "ACTIVE"
      }
    });
  }

  const ownerRoleId = roleIds.get("OWNER");

  if (ownerRoleId) {
    await db.userRole.upsert({
      where: {
        userId_roleId: {
          userId: demoUser.id,
          roleId: ownerRoleId
        }
      },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: ownerRoleId
      }
    });
  }

  const driverSeeds = [
    {
      driverCode: "DRV-ZM-001",
      employeeNo: "DRVEMP-ZM-001",
      name: "Mwansa Demo Driver",
      phone: "+260-000-100001",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      licenseNo: "ZM-LIC-DEMO-001",
      workCountry: "Zambia",
      rewardPenaltyNotes: "Demo 司机，无奖惩异常，默认可承接赞比亚本地配送任务。"
    },
    {
      driverCode: "DRV-CD-001",
      employeeNo: "DRVEMP-CD-001",
      name: "Kabila Demo Driver",
      phone: "+243-000-100001",
      companyId: companies.get("CD_OPERATIONS") ?? null,
      licenseNo: "CD-LIC-DEMO-001",
      workCountry: "Democratic Republic of the Congo",
      rewardPenaltyNotes: "Demo 司机，用于演示第二海外运营主体的配送人员储备。"
    }
  ];

  const drivers = new Map<string, { id: string; name: string }>();

  for (const driverSeed of driverSeeds) {
    const driver = await db.driver.upsert({
      where: { driverCode: driverSeed.driverCode },
      update: {
        employeeNo: driverSeed.employeeNo,
        name: driverSeed.name,
        phone: driverSeed.phone,
        companyId: driverSeed.companyId,
        licenseNo: driverSeed.licenseNo,
        workCountry: driverSeed.workCountry,
        rewardPenaltyNotes: driverSeed.rewardPenaltyNotes,
        status: "ACTIVE"
      },
      create: {
        driverCode: driverSeed.driverCode,
        employeeNo: driverSeed.employeeNo,
        name: driverSeed.name,
        phone: driverSeed.phone,
        companyId: driverSeed.companyId,
        licenseNo: driverSeed.licenseNo,
        workCountry: driverSeed.workCountry,
        rewardPenaltyNotes: driverSeed.rewardPenaltyNotes,
        status: "ACTIVE"
      }
    });

    drivers.set(driver.driverCode ?? driverSeed.driverCode, { id: driver.id, name: driver.name });
  }

  const vehicleSeeds = [
    {
      vehicleCode: "VEH-ZM-001",
      vehicleQrCode: "VEHQR-ZM-001",
      plateNo: "ZM-DEMO-001",
      companyId: companies.get("ZM_OPERATIONS") ?? null,
      ownershipCompanyId: companies.get("ZM_OPERATIONS") ?? null,
      vehicleType: "Box Truck",
      driver: drivers.get("DRV-ZM-001") ?? null,
      maintenanceNote: "车辆状态正常，可用于赞比亚本地销售配送。"
    },
    {
      vehicleCode: "VEH-CD-001",
      vehicleQrCode: "VEHQR-CD-001",
      plateNo: "CD-DEMO-001",
      companyId: companies.get("CD_OPERATIONS") ?? null,
      ownershipCompanyId: companies.get("CD_OPERATIONS") ?? null,
      vehicleType: "Light Truck",
      driver: drivers.get("DRV-CD-001") ?? null,
      maintenanceNote: "备用配送车辆，用于演示刚果金主体车辆台账。"
    }
  ];

  for (const vehicleSeed of vehicleSeeds) {
    await db.vehicle.upsert({
      where: { vehicleCode: vehicleSeed.vehicleCode },
      update: {
        vehicleQrCode: vehicleSeed.vehicleQrCode,
        plateNo: vehicleSeed.plateNo,
        companyId: vehicleSeed.companyId,
        ownershipCompanyId: vehicleSeed.ownershipCompanyId,
        vehicleType: vehicleSeed.vehicleType,
        driverId: vehicleSeed.driver?.id ?? null,
        driverName: vehicleSeed.driver?.name ?? null,
        maintenanceNote: vehicleSeed.maintenanceNote,
        status: "ACTIVE"
      },
      create: {
        vehicleCode: vehicleSeed.vehicleCode,
        vehicleQrCode: vehicleSeed.vehicleQrCode,
        plateNo: vehicleSeed.plateNo,
        companyId: vehicleSeed.companyId,
        ownershipCompanyId: vehicleSeed.ownershipCompanyId,
        vehicleType: vehicleSeed.vehicleType,
        driverId: vehicleSeed.driver?.id ?? null,
        driverName: vehicleSeed.driver?.name ?? null,
        maintenanceNote: vehicleSeed.maintenanceNote,
        status: "ACTIVE"
      }
    });
  }

  const demoConfig = await db.demoConfig.upsert({
    where: { scenarioName: demoScenarioConfig.scenarioName },
    update: {
      origin: demoScenarioConfig.origin,
      destinationWarehouse: demoScenarioConfig.destinationWarehouse,
      customerName: demoScenarioConfig.customerName,
      supplierName: demoScenarioConfig.supplierName,
      productName: demoScenarioConfig.productName,
      totalQuantity: demoScenarioConfig.totalQuantity,
      unit: demoScenarioConfig.unit,
      plannedOutboundQuantity: demoScenarioConfig.plannedOutboundQuantity,
      amount: demoScenarioConfig.amount,
      currency: demoScenarioConfig.currency,
      customerId: demoCustomer.id,
      supplierId: demoSupplier.id,
      skuId: demoSku.id,
      warehouseId: demoWarehouse.id,
      status: "ACTIVE"
    },
    create: {
      scenarioName: demoScenarioConfig.scenarioName,
      origin: demoScenarioConfig.origin,
      destinationWarehouse: demoScenarioConfig.destinationWarehouse,
      customerName: demoScenarioConfig.customerName,
      supplierName: demoScenarioConfig.supplierName,
      productName: demoScenarioConfig.productName,
      totalQuantity: demoScenarioConfig.totalQuantity,
      unit: demoScenarioConfig.unit,
      plannedOutboundQuantity: demoScenarioConfig.plannedOutboundQuantity,
      amount: demoScenarioConfig.amount,
      currency: demoScenarioConfig.currency,
      customerId: demoCustomer.id,
      supplierId: demoSupplier.id,
      skuId: demoSku.id,
      warehouseId: demoWarehouse.id,
      status: "ACTIVE"
    }
  });

  return {
    companies,
    departmentIds,
    roleIds,
    demoUser,
    demoSku,
    demoCustomer,
    demoSupplier,
    demoWarehouse,
    demoLocation,
    demoConfig
  };
}

export async function ensureStandardDemoBusinessScenario(
  db: DbClient,
  foundationInput?: DemoFoundationResult
): Promise<StandardScenarioResult> {
  const foundation = foundationInput ?? (await ensureDemoFoundation(db));
  const scenario = buildStandardDemoScenario();
  const numbers = buildStandardScenarioNumbers();
  const baseTime = addTime(new Date(), -10 * DAY_IN_MS);
  const documentSeeds = buildStandardScenarioDocuments(demoScenarioConfig, baseTime);

  await ensureDemoDocumentFiles(documentSeeds);

  const [existingContract, existingBatch] = await Promise.all([
    db.contract.findUnique({
      where: { contractNo: standardScenarioIdentifiers.contractNo },
      select: { id: true }
    }),
    db.batch.findUnique({
      where: { batchNo: standardScenarioIdentifiers.batchNo },
      select: { id: true }
    })
  ]);

  if (existingContract && existingBatch) {
    return {
      created: false,
      identifiers: standardScenarioIdentifiers,
      contractId: existingContract.id,
      batchId: existingBatch.id
    };
  }

  if (existingContract || existingBatch) {
    throw new Error("Standard demo scenario already partially exists. Please reset the demo environment first.");
  }

  const documentMap = new Map<StandardScenarioDocumentSeed["key"], { id: string }>();

  for (const seed of documentSeeds) {
    const document = await db.document.create({
      data: {
        documentType: seed.documentType,
        fileName: seed.fileName,
        originalName: seed.originalName,
        filePath: seed.filePath,
        fileUrl: seed.fileUrl,
        mimeType: seed.mimeType,
        size: Buffer.byteLength(seed.content, "utf8"),
        status: DocumentStatus.ACTIVE,
        aiStatus: DocumentAiStatus.EXTRACTED,
        extractedJson: seed.extractedJson,
        contractNoDraft: standardScenarioIdentifiers.contractNo,
        batchNoDraft: standardScenarioIdentifiers.batchNo,
        businessCreated: false,
        version: 1,
        createdAt: seed.createdAt,
        updatedAt: seed.createdAt
      },
      select: {
        id: true
      }
    });

    documentMap.set(seed.key, document);

    await db.aiLog.create({
      data: {
        taskType: AiTaskType.DOCUMENT_EXTRACT,
        status: AiTaskStatus.SUCCESS,
        scenario: foundation.demoConfig.scenarioName,
        provider: "mock",
        model: "standard-demo-seed",
        userId: foundation.demoUser.id,
        documentId: document.id,
        promptText: "Restore standard demo document extraction result.",
        inputText: seed.originalName,
        responseText: `已恢复 ${seed.originalName} 的标准识别结果。`,
        outputText: `已恢复 ${seed.originalName} 的标准识别结果。`,
        responseJson: seed.extractedJson,
        parsedJson: seed.extractedJson,
        createdAt: seed.createdAt,
        updatedAt: seed.createdAt
      }
    });
  }

  const contractDocumentId = documentMap.get("contract")?.id;
  const packingListDocumentId = documentMap.get("packingList")?.id;
  const invoiceDocumentId = documentMap.get("invoice")?.id;
  const billOfLadingDocumentId = documentMap.get("billOfLading")?.id;

  if (!contractDocumentId || !packingListDocumentId || !invoiceDocumentId || !billOfLadingDocumentId) {
    throw new Error("Failed to create standard demo documents.");
  }

  const contractCreatedAt = addTime(baseTime, DAY_IN_MS);
  const logisticsStartAt = addTime(baseTime, 2 * DAY_IN_MS);
  const customsCompletedAt = addTime(baseTime, 7 * DAY_IN_MS);
  const inboundCompletedAt = addTime(baseTime, 8 * DAY_IN_MS);
  const outboundCompletedAt = addTime(baseTime, 9 * DAY_IN_MS);
  const receivableDueAt = addTime(baseTime, 15 * DAY_IN_MS);
  const actualArrivalAt = addTime(baseTime, 6 * DAY_IN_MS);

  const contract = await db.contract.create({
    data: {
      contractNo: standardScenarioIdentifiers.contractNo,
      contractType: "PURCHASE",
      customerId: foundation.demoCustomer.id,
      customerName: foundation.demoCustomer.name,
      supplierId: foundation.demoSupplier.id,
      supplierName: foundation.demoSupplier.name,
      companyId: foundation.companies.get("HK_SETTLEMENT") ?? null,
      productName: scenario.productName,
      totalQuantity: scenario.totalQuantity,
      unit: scenario.unit,
      amount: scenario.amount,
      currency: scenario.currency,
      destinationWarehouse: scenario.destinationWarehouse,
      paymentStatus: PaymentStatus.UNPAID,
      executionStatus: "WAITING_RECEIPT",
      executionProgress: 85,
      isOverdue: false,
      overdueDays: 0,
      breachStatus: "NONE",
      plannedReceiptAmount: scenario.amount,
      actualReceiptAmount: 0,
      plannedPaymentAmount: 30000,
      actualPaymentAmount: 0,
      receiptPaymentPlanJson: toJsonObject({
        receiptPlan: [
          {
            name: "客户回款计划",
            plannedAmount: scenario.amount,
            actualAmount: 0,
            currency: scenario.currency,
            dueDate: receivableDueAt.toISOString(),
            status: "UNPAID"
          }
        ],
        paymentPlan: [
          {
            name: "供应商付款计划",
            plannedAmount: 30000,
            actualAmount: 0,
            currency: scenario.currency,
            status: "DEMO_NOT_POSTED"
          }
        ],
        comparison: {
          plannedReceiptAmount: scenario.amount,
          actualReceiptAmount: 0,
          plannedPaymentAmount: 30000,
          actualPaymentAmount: 0,
          receiptGap: scenario.amount,
          paymentGap: 30000
        },
        note: "标准演示 seed 的阶段22合同执行计划底座。"
      }),
      status: ContractStatus.ACTIVE,
      sourceDocumentId: contractDocumentId,
      createdAt: contractCreatedAt,
      updatedAt: outboundCompletedAt
    }
  });

  await db.contractItem.create({
    data: {
      contractId: contract.id,
      skuId: foundation.demoSku.id,
      skuCode: foundation.demoSku.skuCode,
      skuName: foundation.demoSku.name,
      quantity: scenario.totalQuantity,
      unit: scenario.unit,
      unitPrice: numbers.unitPrice,
      amount: scenario.amount,
      currency: scenario.currency,
      createdAt: contractCreatedAt
    }
  });

  const batch = await db.batch.create({
    data: {
      batchNo: standardScenarioIdentifiers.batchNo,
      contractId: contract.id,
      sourceDocumentId: packingListDocumentId,
      skuId: foundation.demoSku.id,
      sku: foundation.demoSku.skuCode,
      productName: scenario.productName,
      totalQuantity: scenario.totalQuantity,
      unit: scenario.unit,
      destinationWarehouse: scenario.destinationWarehouse,
      warehouseId: foundation.demoWarehouse.id,
      status: BatchStatus.PARTIAL_OUTBOUND,
      createdAt: contractCreatedAt,
      updatedAt: outboundCompletedAt
    }
  });

  const purchaseOrder = await db.purchaseOrder.create({
    data: {
      purchaseNo: standardScenarioIdentifiers.purchaseNo,
      contractId: contract.id,
      supplierId: foundation.demoSupplier.id,
      supplierName: foundation.demoSupplier.name,
      companyId: foundation.companies.get("CN_MAIN") ?? null,
      skuId: foundation.demoSku.id,
      skuName: foundation.demoSku.name,
      batchId: batch.id,
      quantity: scenario.totalQuantity,
      unit: scenario.unit,
      deliveryDate: logisticsStartAt,
      status: "COLLECTION_COMPLETED",
      createdAt: contractCreatedAt,
      updatedAt: logisticsStartAt
    }
  });

  await db.purchaseOrderItem.create({
    data: {
      purchaseOrderId: purchaseOrder.id,
      skuId: foundation.demoSku.id,
      skuCode: foundation.demoSku.skuCode,
      skuName: foundation.demoSku.name,
      quantity: scenario.totalQuantity,
      unit: scenario.unit,
      unitPrice: numbers.unitPrice,
      amount: scenario.amount,
      currency: scenario.currency,
      createdAt: contractCreatedAt
    }
  });

  const shipment = await db.shipment.create({
    data: {
      shipmentNo: standardScenarioIdentifiers.shipmentNo,
      contractId: contract.id,
      batchId: batch.id,
      purchaseOrderId: purchaseOrder.id,
      shippingCompany: "Demo Shipping Line",
      billOfLadingNo: standardScenarioIdentifiers.billOfLadingNo,
      containerNo: standardScenarioIdentifiers.containerNo,
      originPort: "Shenzhen Port",
      destinationPort: "Dar es Salaam Port",
      departureTime: addTime(baseTime, 3 * DAY_IN_MS),
      estimatedArrivalTime: addTime(baseTime, 6 * DAY_IN_MS),
      actualArrivalTime: actualArrivalAt,
      status: "WAREHOUSE_DELIVERED",
      createdAt: logisticsStartAt,
      updatedAt: inboundCompletedAt
    }
  });

  const shipmentNodes = [
    {
      nodeName: "国内集货完成",
      nodeStatus: "DONE",
      nodeTime: logisticsStartAt,
      remark: "标准演示链路默认已完成国内集货。"
    },
    {
      nodeName: "已装柜",
      nodeStatus: "DONE",
      nodeTime: addTime(baseTime, 3 * DAY_IN_MS),
      remark: "已完成装柜。"
    },
    {
      nodeName: "已离港",
      nodeStatus: "DONE",
      nodeTime: addTime(baseTime, 4 * DAY_IN_MS),
      remark: "海运已发出。"
    },
    {
      nodeName: "海运中",
      nodeStatus: "DONE",
      nodeTime: addTime(baseTime, 5 * DAY_IN_MS),
      remark: "演示货物已进入海运。"
    },
    {
      nodeName: "到达目的港",
      nodeStatus: "DONE",
      nodeTime: actualArrivalAt,
      remark: "已到达目的港。"
    },
    {
      nodeName: "待清关",
      nodeStatus: "DONE",
      nodeTime: addTime(baseTime, 6 * DAY_IN_MS + 4 * HOUR_IN_MS),
      remark: "已进入清关处理。"
    }
  ];

  for (const node of shipmentNodes) {
    await db.shipmentNode.create({
      data: {
        shipmentId: shipment.id,
        nodeName: node.nodeName,
        nodeStatus: node.nodeStatus,
        nodeTime: node.nodeTime,
        remark: node.remark,
        createdAt: node.nodeTime
      }
    });
  }

  const customsCheckResult = toJsonObject({
    packingListQuantity: `${scenario.totalQuantity}${scenario.unit}`,
    invoiceQuantity: `${scenario.totalQuantity}${scenario.unit}`,
    billOfLadingContainerNo: standardScenarioIdentifiers.containerNo,
    aiConclusion: "单据数量一致，可进入清关流程。"
  });

  const customsClearance = await db.customsClearance.create({
    data: {
      clearanceNo: standardScenarioIdentifiers.clearanceNo,
      contractId: contract.id,
      batchId: batch.id,
      shipmentId: shipment.id,
      responsibleCompany: "赞比亚公司",
      responsiblePerson: "Demo Customs Owner",
      packingListDocumentId,
      invoiceDocumentId,
      billOfLadingDocumentId,
      aiCheckResult: customsCheckResult,
      status: "COMPLETED",
      createdAt: addTime(baseTime, 6 * DAY_IN_MS + 5 * HOUR_IN_MS),
      updatedAt: customsCompletedAt
    }
  });

  const preReceiveOrder = await db.preReceiveOrder.create({
    data: {
      preReceiveNo: standardScenarioIdentifiers.preReceiveNo,
      contractId: contract.id,
      batchId: batch.id,
      warehouseId: foundation.demoWarehouse.id,
      appointmentNo: `APT-${standardScenarioIdentifiers.batchNo}`,
      appointmentTime: addTime(baseTime, 7 * DAY_IN_MS + 2 * HOUR_IN_MS),
      expectedArrivalTime: inboundCompletedAt,
      waveNo: `WAVE-IN-${standardScenarioIdentifiers.batchNo}`,
      dockNo: "DOCK-01",
      arrivalStatus: "ARRIVED",
      skuName: foundation.demoSku.name,
      quantity: scenario.totalQuantity,
      unit: scenario.unit,
      suggestedLocation: foundation.demoLocation.locationCode,
      status: "COMPLETED",
      createdAt: customsCompletedAt,
      updatedAt: inboundCompletedAt
    }
  });

  const inboundOrder = await db.inboundOrder.create({
    data: {
      inboundNo: standardScenarioIdentifiers.inboundNo,
      contractId: contract.id,
      batchId: batch.id,
      warehouseId: foundation.demoWarehouse.id,
      quantity: scenario.totalQuantity,
      unit: scenario.unit,
      status: "COMPLETED",
      createdAt: customsCompletedAt,
      updatedAt: inboundCompletedAt
    }
  });

  const salesOrder = await db.salesOrder.create({
    data: {
      salesNo: standardScenarioIdentifiers.salesNo,
      contractId: contract.id,
      batchId: batch.id,
      customerId: foundation.demoCustomer.id,
      customerName: foundation.demoCustomer.name,
      companyId: foundation.companies.get("ZM_OPERATIONS") ?? null,
      skuName: foundation.demoSku.name,
      quantity: scenario.plannedOutboundQuantity,
      unit: scenario.unit,
      amount: numbers.outboundAmount,
      currency: scenario.currency,
      deliveryMethod: "本地配送",
      deliveryStatus: "IN_TRANSIT",
      signStatus: "UNSIGNED",
      status: "IN_DELIVERY",
      createdAt: inboundCompletedAt,
      updatedAt: outboundCompletedAt
    }
  });

  await db.salesOrderItem.create({
    data: {
      salesOrderId: salesOrder.id,
      skuId: foundation.demoSku.id,
      skuCode: foundation.demoSku.skuCode,
      skuName: foundation.demoSku.name,
      quantity: scenario.plannedOutboundQuantity,
      unit: scenario.unit,
      unitPrice: numbers.unitPrice,
      amount: numbers.outboundAmount,
      currency: scenario.currency,
      createdAt: inboundCompletedAt
    }
  });

  const outboundOrder = await db.outboundOrder.create({
    data: {
      outboundNo: standardScenarioIdentifiers.outboundNo,
      salesOrderId: salesOrder.id,
      contractId: contract.id,
      batchId: batch.id,
      warehouseId: foundation.demoWarehouse.id,
      waveNo: `WAVE-OUT-${standardScenarioIdentifiers.batchNo}`,
      pickupListNo: `PKL-${standardScenarioIdentifiers.batchNo}`,
      reviewStatus: "APPROVED",
      firstReviewerName: "Demo Warehouse Owner",
      firstReviewedAt: addTime(baseTime, 9 * DAY_IN_MS - 2 * HOUR_IN_MS),
      secondReviewerName: "Demo Warehouse Owner",
      secondReviewedAt: addTime(baseTime, 9 * DAY_IN_MS - HOUR_IN_MS),
      pickingStatus: "READY_TO_SCAN",
      quantity: scenario.plannedOutboundQuantity,
      unit: scenario.unit,
      status: "COMPLETED",
      createdAt: inboundCompletedAt,
      updatedAt: outboundCompletedAt
    }
  });

  const deliveryOrder = await db.deliveryOrder.create({
    data: {
      deliveryNo: standardScenarioIdentifiers.deliveryNo,
      salesOrderId: salesOrder.id,
      batchId: batch.id,
      warehouseId: foundation.demoWarehouse.id,
      warehouseName: foundation.demoWarehouse.name,
      quantity: scenario.plannedOutboundQuantity,
      unit: scenario.unit,
      status: "IN_TRANSIT",
      createdAt: outboundCompletedAt,
      updatedAt: outboundCompletedAt
    }
  });

  const payment = await db.payment.create({
    data: {
      contractId: contract.id,
      customerId: foundation.demoCustomer.id,
      receivableAmount: scenario.amount,
      receivedAmount: 0,
      currency: scenario.currency,
      status: PaymentStatus.UNPAID,
      dueDate: receivableDueAt,
      createdAt: contractCreatedAt,
      updatedAt: outboundCompletedAt
    }
  });

  const receivable = await db.receivable.create({
    data: {
      contractId: contract.id,
      salesOrderId: salesOrder.id,
      customerId: foundation.demoCustomer.id,
      amount: scenario.amount,
      currency: scenario.currency,
      dueDate: receivableDueAt,
      receivedAmount: 0,
      status: "UNPAID",
      createdAt: outboundCompletedAt,
      updatedAt: outboundCompletedAt
    }
  });

  await db.invoice.create({
    data: {
      invoiceNo: standardScenarioIdentifiers.invoiceNo,
      contractId: contract.id,
      invoiceType: "COMMERCIAL",
      amount: scenario.amount,
      currency: scenario.currency,
      issueDate: addTime(baseTime, 2 * DAY_IN_MS),
      status: "ISSUED",
      documentId: invoiceDocumentId,
      createdAt: addTime(baseTime, 2 * DAY_IN_MS),
      updatedAt: addTime(baseTime, 2 * DAY_IN_MS)
    }
  });

  const workOrders = [
    {
      workOrderNo: standardScenarioIdentifiers.supplierWorkOrderNo,
      type: "SUPPLIER_DELIVERY_FOLLOW_UP",
      title: "供应商发货跟进工单",
      content: "标准演示链路默认已完成供应商发货与国内集货。",
      responsibleDepartment: "采购部",
      responsiblePerson: "Demo Procurement Owner",
      status: "COMPLETED",
      priority: "NORMAL",
      startTime: contractCreatedAt,
      dueTime: logisticsStartAt,
      contractId: contract.id,
      batchId: batch.id,
      relatedEntityType: "PurchaseOrder",
      relatedEntityId: purchaseOrder.id,
      completionCondition: "供应商发货并完成国内集货。"
    },
    {
      workOrderNo: standardScenarioIdentifiers.logisticsWorkOrderNo,
      type: "LOGISTICS_ARRANGEMENT",
      title: "国际运输安排工单",
      content: "标准演示链路默认已生成国际运输安排记录。",
      responsibleDepartment: "物流部",
      responsiblePerson: "Demo Logistics Owner",
      status: "COMPLETED",
      priority: "NORMAL",
      startTime: logisticsStartAt,
      dueTime: addTime(baseTime, 3 * DAY_IN_MS),
      contractId: contract.id,
      batchId: batch.id,
      relatedEntityType: "Shipment",
      relatedEntityId: shipment.id,
      completionCondition: "完成运输安排并生成提单。"
    },
    {
      workOrderNo: standardScenarioIdentifiers.customsWorkOrderNo,
      type: "CUSTOMS_CLEARANCE",
      title: "清关工单",
      content: "标准演示链路默认已完成清关，可直接演示单据一致性检查结果。",
      responsibleDepartment: "清关部",
      responsiblePerson: "Demo Customs Owner",
        status: "COMPLETED",
        priority: "HIGH",
        startTime: actualArrivalAt,
        dueTime: customsCompletedAt,
        contractId: contract.id,
        batchId: batch.id,
        documentId: billOfLadingDocumentId,
        relatedEntityType: "CustomsClearance",
        relatedEntityId: customsClearance.id,
        completionCondition: "完成清关并生成仓库预收货。"
      },
    {
      workOrderNo: standardScenarioIdentifiers.warehouseWorkOrderNo,
      type: "WAREHOUSE_PRE_RECEIVE",
      title: "仓库预收货工单",
      content: "标准演示链路默认已完成预收货与扫码入库。",
      responsibleDepartment: "仓库部",
      responsiblePerson: "Demo Warehouse Owner",
      status: "COMPLETED",
      priority: "NORMAL",
      startTime: customsCompletedAt,
      dueTime: inboundCompletedAt,
      contractId: contract.id,
      batchId: batch.id,
      relatedEntityType: "PreReceiveOrder",
      relatedEntityId: preReceiveOrder.id,
      completionCondition: "完成预收货并完成100箱扫码入库。"
    },
    {
      workOrderNo: standardScenarioIdentifiers.receivableWorkOrderNo,
      type: "RECEIVABLE_FOLLOW_UP",
      title: "财务回款跟进工单",
      content: "标准演示链路默认保留未回款状态，方便继续演示财务回款模块。",
      responsibleDepartment: "财务部",
      responsiblePerson: "Demo Finance Owner",
      status: "PENDING",
      priority: "NORMAL",
      startTime: outboundCompletedAt,
      dueTime: receivableDueAt,
      contractId: contract.id,
      batchId: batch.id,
      documentId: invoiceDocumentId,
      relatedEntityType: "Receivable",
      relatedEntityId: receivable.id,
      completionCondition: "完成客户回款并进入可核销状态。"
    }
  ];

  for (const workOrder of workOrders) {
    await db.workOrder.create({
      data: {
        ...workOrder,
        createdAt: workOrder.startTime ?? contractCreatedAt,
        updatedAt: workOrder.status === "PENDING" ? outboundCompletedAt : workOrder.dueTime ?? outboundCompletedAt
      }
    });
  }

  const outboundQrItemIds: string[] = [];

  for (let serialNo = 1; serialNo <= scenario.totalQuantity; serialNo += 1) {
    const qrCode = `${batch.batchNo}-${String(serialNo).padStart(4, "0")}`;
    const inboundAt = addTime(baseTime, 8 * DAY_IN_MS + serialNo * 1000);
    const isOutbound = serialNo <= scenario.plannedOutboundQuantity;
    const outboundAt = isOutbound ? addTime(baseTime, 9 * DAY_IN_MS + serialNo * 1000) : null;
    const unitTraceCode = buildTraceCode(batch.batchNo, "UNIT", serialNo);
    const boxTraceCode = buildTraceCode(batch.batchNo, "BOX", serialNo);
    const palletTraceCode = buildTraceCode(batch.batchNo, "PALLET", Math.ceil(serialNo / PALLET_SIZE));

    const qrItem = await db.qrItem.create({
      data: {
        qrCode,
        batchId: batch.id,
        contractId: contract.id,
        skuId: foundation.demoSku.id,
        serialNo,
        productName: scenario.productName,
        status: isOutbound ? QrItemStatus.OUTBOUND : QrItemStatus.IN_STOCK,
        currentWarehouse: foundation.demoWarehouse.name,
        warehouseId: foundation.demoWarehouse.id,
        locationId: foundation.demoLocation.id,
        unitTraceCode,
        boxTraceCode,
        palletTraceCode,
        inboundAt,
        outboundAt,
        createdAt: contractCreatedAt,
        updatedAt: outboundAt ?? inboundAt
      }
    });

    await db.stockMovement.create({
      data: {
        qrItemId: qrItem.id,
        batchId: batch.id,
        contractId: contract.id,
        skuId: foundation.demoSku.id,
        movementType: StockMovementType.INBOUND,
        fromStatus: QrItemStatus.PENDING_INBOUND,
        toStatus: QrItemStatus.IN_STOCK,
        warehouseName: foundation.demoWarehouse.name,
        warehouseId: foundation.demoWarehouse.id,
        locationId: foundation.demoLocation.id,
        operatorId: foundation.demoUser.id,
        operatorName: foundation.demoUser.displayName,
        note: "标准演示场景恢复：扫码入库",
        remark: "恢复标准演示链路时自动补入库流水。",
        occurredAt: inboundAt,
        createdAt: inboundAt
      }
    });

    if (isOutbound && outboundAt) {
      outboundQrItemIds.push(qrItem.id);

      await db.stockMovement.create({
        data: {
          qrItemId: qrItem.id,
          batchId: batch.id,
          contractId: contract.id,
          skuId: foundation.demoSku.id,
          movementType: StockMovementType.OUTBOUND,
          fromStatus: QrItemStatus.IN_STOCK,
          toStatus: QrItemStatus.OUTBOUND,
          warehouseName: foundation.demoWarehouse.name,
          warehouseId: foundation.demoWarehouse.id,
          locationId: foundation.demoLocation.id,
          operatorId: foundation.demoUser.id,
          operatorName: foundation.demoUser.displayName,
          note: "标准演示场景恢复：扫码出库",
          remark: "恢复标准演示链路时自动补出库流水。",
          occurredAt: outboundAt,
          createdAt: outboundAt
        }
      });
    }
  }

  for (const qrItemId of outboundQrItemIds) {
    await db.deliveryOrderItem.create({
      data: {
        deliveryOrderId: deliveryOrder.id,
        qrItemId,
        skuId: foundation.demoSku.id,
        quantity: 1,
        unit: scenario.unit,
        createdAt: outboundCompletedAt
      }
    });
  }

  const documentUpdates = [
    {
      id: contractDocumentId,
      relatedEntityType: "Contract",
      relatedEntityId: contract.id
    },
    {
      id: packingListDocumentId,
      relatedEntityType: "Batch",
      relatedEntityId: batch.id
    },
    {
      id: invoiceDocumentId,
      relatedEntityType: "Receivable",
      relatedEntityId: receivable.id
    },
    {
      id: billOfLadingDocumentId,
      relatedEntityType: "Shipment",
      relatedEntityId: shipment.id
    }
  ];

  for (const update of documentUpdates) {
    await db.document.update({
      where: { id: update.id },
      data: {
        businessCreated: true,
        status: DocumentStatus.ACTIVE,
        relatedEntityType: update.relatedEntityType,
        relatedEntityId: update.relatedEntityId,
        updatedAt: outboundCompletedAt
      }
    });
  }

  await db.aiLog.create({
    data: {
      taskType: AiTaskType.INVENTORY_QA,
      status: AiTaskStatus.SUCCESS,
      scenario: foundation.demoConfig.scenarioName,
      provider: "mock",
      model: "standard-demo-seed",
      userId: foundation.demoUser.id,
      promptText: "这批货现在还有多少？",
      inputText: "这批货现在还有多少？",
      responseText: `当前共生成 ${scenario.totalQuantity} 个二维码，已出库 ${scenario.plannedOutboundQuantity}${scenario.unit}，在库 ${numbers.remainingQuantity}${scenario.unit}。`,
      outputText: `当前共生成 ${scenario.totalQuantity} 个二维码，已出库 ${scenario.plannedOutboundQuantity}${scenario.unit}，在库 ${numbers.remainingQuantity}${scenario.unit}。`,
      responseJson: toJsonObject({
        totalQrItems: scenario.totalQuantity,
        outboundQuantity: scenario.plannedOutboundQuantity,
        realtimeInventory: numbers.remainingQuantity
      }),
      parsedJson: toJsonObject({
        answer: `当前在库 ${numbers.remainingQuantity}${scenario.unit}`
      }),
      createdAt: outboundCompletedAt,
      updatedAt: outboundCompletedAt
    }
  });

  return {
    created: true,
    identifiers: standardScenarioIdentifiers,
    contractId: contract.id,
    batchId: batch.id
  };
}
