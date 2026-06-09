import { prisma } from "../src/lib/prisma";
import { ensureDemoFoundation } from "../src/services/demoFoundation";

async function main() {
  const foundation = await ensureDemoFoundation(prisma);

  console.log("[seed] ERP demo foundation ready:", {
    companies: foundation.companies.size,
    departments: foundation.departmentIds.size,
    demoUser: foundation.demoUser.username,
    demoScenario: foundation.demoConfig.scenarioName,
    demoWarehouse: foundation.demoWarehouse.name,
    businessDataInitialized: false
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
