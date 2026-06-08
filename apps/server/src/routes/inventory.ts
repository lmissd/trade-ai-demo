import { Router } from "express";
import { buildInventorySummary, normalizeInventoryQueryValue } from "../services/inventorySummary";

export const inventoryRouter = Router();

inventoryRouter.get("/summary", async (request, response) => {
  const batchId = normalizeInventoryQueryValue(request.query.batchId);
  const contractId = normalizeInventoryQueryValue(request.query.contractId);
  const warehouseId = normalizeInventoryQueryValue(request.query.warehouseId);

  response.json(
    await buildInventorySummary({
      batchId,
      contractId,
      warehouseId
    })
  );
});
