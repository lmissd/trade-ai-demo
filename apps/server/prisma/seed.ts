import { SystemUserRole } from "@prisma/client";
import { demoScenarioConfig } from "../src/config/demoScenario";
import { prisma } from "../src/lib/prisma";

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

async function main() {
  const companies = new Map<string, string>();

  for (const companySeed of companySeeds) {
    const company = await prisma.company.upsert({
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
    const department = await prisma.department.upsert({
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

  const demoSku = await prisma.sku.upsert({
    where: { skuCode: "SKU-DEMO-001" },
    update: {
      name: demoScenarioConfig.productName,
      spec: "Demo Standard",
      unit: demoScenarioConfig.unit,
      category: "Demo Goods",
      purchaseReferencePrice: 300,
      salesReferencePrice: 500,
      status: "ACTIVE"
    },
    create: {
      skuCode: "SKU-DEMO-001",
      name: demoScenarioConfig.productName,
      spec: "Demo Standard",
      unit: demoScenarioConfig.unit,
      category: "Demo Goods",
      purchaseReferencePrice: 300,
      salesReferencePrice: 500,
      status: "ACTIVE"
    }
  });

  const demoCustomer = await prisma.customer.upsert({
    where: { customerCode: "CUST-ZM-001" },
    update: {
      name: demoScenarioConfig.customerName,
      country: "Zambia",
      contactName: "Demo Customer Contact",
      phone: "+260-000-000001",
      email: "buyer@abctrading.example",
      address: "Lusaka, Zambia",
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
      status: "ACTIVE"
    }
  });

  const demoSupplier = await prisma.supplier.upsert({
    where: { supplierCode: "SUP-CN-001" },
    update: {
      name: demoScenarioConfig.supplierName,
      country: "China",
      contactName: "Demo Supplier Contact",
      phone: "+86-000-0000001",
      email: "sales@china-supplier.example",
      address: "Shenzhen, China",
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
      status: "ACTIVE"
    }
  });

  const demoWarehouse = await prisma.warehouse.upsert({
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

  await prisma.warehouseLocation.upsert({
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
    const role = await prisma.role.upsert({
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

  const demoUser = await prisma.user.upsert({
    where: { username: "demo-owner" },
    update: {
      displayName: "Demo Owner",
      email: "owner@trade-ai-demo.local",
      phone: "+852-0000-0001",
      role: SystemUserRole.OWNER,
      status: "ACTIVE",
      companyId: companies.get("HK_SETTLEMENT") ?? null,
      departmentId: departmentIds.get("FINANCE") ?? null
    },
    create: {
      username: "demo-owner",
      displayName: "Demo Owner",
      email: "owner@trade-ai-demo.local",
      phone: "+852-0000-0001",
      role: SystemUserRole.OWNER,
      status: "ACTIVE",
      companyId: companies.get("HK_SETTLEMENT") ?? null,
      departmentId: departmentIds.get("FINANCE") ?? null
    }
  });

  const ownerRoleId = roleIds.get("OWNER");

  if (ownerRoleId) {
    await prisma.userRole.upsert({
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

  const demoConfig = await prisma.demoConfig.upsert({
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

  console.log("[seed] ERP demo foundation ready:", {
    companies: companies.size,
    departments: departmentIds.size,
    demoUser: demoUser.username,
    demoScenario: demoConfig.scenarioName,
    demoWarehouse: demoWarehouse.name
  });
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
