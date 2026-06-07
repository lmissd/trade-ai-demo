import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import { AiAssistantPage } from "../pages/AiAssistantPage";
import { BatchesPage } from "../pages/BatchesPage";
import { ContractsPage } from "../pages/ContractsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { InventoryPage } from "../pages/InventoryPage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { QrItemsPage } from "../pages/QrItemsPage";
import { ScanPage } from "../pages/ScanPage";

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
        path: "/qr-items",
        element: <QrItemsPage />
      },
      {
        path: "/scan",
        element: <ScanPage />
      },
      {
        path: "/inventory",
        element: <InventoryPage />
      },
      {
        path: "/payments",
        element: <PaymentsPage />
      },
      {
        path: "/ai-assistant",
        element: <AiAssistantPage />
      }
    ]
  }
]);
