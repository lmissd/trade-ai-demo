import { Router } from "express";
import type { DashboardOrderView } from "../services/dashboardOverview";
import { normalizeInventoryQueryValue } from "../services/inventorySummary";
import { getDashboardOverview } from "../services/dashboardOverview";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", async (request, response) => {
  const focusContractId = normalizeInventoryQueryValue(request.query.focusContractId);
  const orderView = normalizeInventoryQueryValue(request.query.orderView);

  response.json(
    await getDashboardOverview({
      focusContractId,
      orderView: orderView as DashboardOrderView | null
    })
  );
});
