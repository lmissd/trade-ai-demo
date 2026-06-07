import { env } from "./env";

export type DemoScenarioConfig = {
  scenarioName: string;
  origin: string;
  productName: string;
  customerName: string;
  supplierName: string;
  destinationWarehouse: string;
  totalQuantity: number;
  unit: string;
  plannedOutboundQuantity: number;
  amount: number;
  currency: string;
};

function validateScenario(config: DemoScenarioConfig) {
  if (config.totalQuantity <= 0) {
    throw new Error("Demo scenario total quantity must be greater than 0.");
  }

  if (config.plannedOutboundQuantity < 0) {
    throw new Error("Demo scenario planned outbound quantity cannot be negative.");
  }

  if (config.plannedOutboundQuantity > config.totalQuantity) {
    throw new Error("Demo scenario planned outbound quantity cannot exceed total quantity.");
  }

  if (config.amount < 0) {
    throw new Error("Demo scenario amount cannot be negative.");
  }
}

export const demoScenarioConfig: DemoScenarioConfig = {
  scenarioName: env.demoScenarioName,
  origin: env.demoOrigin,
  productName: env.demoProductName,
  customerName: env.demoCustomerName,
  supplierName: env.demoSupplierName,
  destinationWarehouse: env.demoDestinationWarehouse,
  totalQuantity: env.demoTotalQuantity,
  unit: env.demoUnit,
  plannedOutboundQuantity: env.demoPlannedOutboundQuantity,
  amount: env.demoAmount,
  currency: env.demoCurrency
};

validateScenario(demoScenarioConfig);
