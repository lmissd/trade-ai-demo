import path from "node:path";
import dotenv from "dotenv";

const workspaceRoot = path.resolve(__dirname, "../../../../");
const localEnvPath = path.join(workspaceRoot, ".env");
const exampleEnvPath = path.join(workspaceRoot, ".env.example");

dotenv.config({ path: localEnvPath });
dotenv.config({ path: exampleEnvPath, override: false });

function readString(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readNumber(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a valid number.`);
  }

  return value;
}

export const env = {
  serverPort: readNumber("SERVER_PORT", 3001),
  databaseUrl: readString("DATABASE_URL", "file:./apps/server/prisma/dev.db"),
  aiProvider: readString("AI_PROVIDER", "mock"),
  aiApiKey: process.env.AI_API_KEY?.trim() ?? "",
  aiModel: process.env.AI_MODEL?.trim() ?? "",
  demoScenarioName: readString("DEMO_SCENARIO_NAME", "default-zambia-demo"),
  demoOrigin: readString("DEMO_ORIGIN", "China"),
  demoProductName: readString("DEMO_PRODUCT_NAME", "Demo Goods"),
  demoCustomerName: readString("DEMO_CUSTOMER_NAME", "ABC Trading Zambia"),
  demoSupplierName: readString("DEMO_SUPPLIER_NAME", "China Supplier Co., Ltd."),
  demoDestinationWarehouse: readString("DEMO_DESTINATION_WAREHOUSE", "Zambia Warehouse"),
  demoTotalQuantity: readNumber("DEMO_TOTAL_QUANTITY", 100),
  demoUnit: readString("DEMO_UNIT", "箱"),
  demoPlannedOutboundQuantity: readNumber("DEMO_PLANNED_OUTBOUND_QUANTITY", 20),
  demoAmount: readNumber("DEMO_AMOUNT", 50000),
  demoCurrency: readString("DEMO_CURRENCY", "USD")
} as const;
