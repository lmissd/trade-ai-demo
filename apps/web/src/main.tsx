import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { RouterProvider } from "react-router-dom";
import zhCN from "antd/locale/zh_CN";
import { appRouter } from "./routes/appRouter";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#c55a11",
          borderRadius: 16,
          fontFamily:
            "\"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
        }
      }}
    >
      <RouterProvider router={appRouter} />
    </ConfigProvider>
  </React.StrictMode>
);
