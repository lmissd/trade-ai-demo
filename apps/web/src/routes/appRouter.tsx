import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import { AiAssistantPage } from "../pages/AiAssistantPage";
import { BatchesPage } from "../pages/BatchesPage";
import { CompaniesPage } from "../pages/CompaniesPage";
import { ContractsPage } from "../pages/ContractsPage";
import { CostsPage } from "../pages/CostsPage";
import { CustomsPage } from "../pages/CustomsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { FinancePage } from "../pages/FinancePage";
import { LogisticsPage } from "../pages/LogisticsPage";
import { ProcurementPage } from "../pages/ProcurementPage";
import { QrItemsPage } from "../pages/QrItemsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SalesPage } from "../pages/SalesPage";
import { WarehousePage } from "../pages/WarehousePage";
import { WorkOrdersPage } from "../pages/WorkOrdersPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: "/dashboard",
        element: <DashboardPage />
      },
      {
        path: "/documents",
        element: <DocumentsPage />
      },
      {
        path: "/contracts",
        element: <ContractsPage />
      },
      {
        path: "/batches",
        element: <BatchesPage />
      },
      {
        path: "/procurement",
        element: <ProcurementPage />
      },
      {
        path: "/logistics",
        element: <LogisticsPage />
      },
      {
        path: "/customs",
        element: <CustomsPage />
      },
      {
        path: "/warehouse",
        element: <WarehousePage />
      },
      {
        path: "/sales",
        element: <SalesPage />
      },
      {
        path: "/finance",
        element: <FinancePage />
      },
      {
        path: "/costs",
        element: <CostsPage />
      },
      {
        path: "/companies",
        element: <CompaniesPage />
      },
      {
        path: "/work-orders",
        element: <WorkOrdersPage />
      },
      {
        path: "/reports",
        element: <ReportsPage />
      },
      {
        path: "/qr-items",
        element: <QrItemsPage />
      },
      {
        path: "/ai-assistant",
        element: <AiAssistantPage />
      },
      {
        path: "/scan",
        element: <Navigate to="/warehouse" replace />
      },
      {
        path: "/inventory",
        element: <Navigate to="/warehouse" replace />
      },
      {
        path: "/payments",
        element: <Navigate to="/finance" replace />
      }
    ]
  }
]);
