import { Grid, Layout, Menu, Space, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { routeMenuEntries, routeMenuItems, routeMetaByPath } from "../routes/routeMeta";

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;

function resolveSelectedMenuKey(pathname: string) {
  const compatibilityMenuKeyByPrefix = [
    { prefix: "/contracts", key: "/documents" },
    { prefix: "/batches", key: "/documents" },
    { prefix: "/scan", key: "/warehouse" },
    { prefix: "/inventory", key: "/warehouse" },
    { prefix: "/payments", key: "/finance" }
  ];

  const compatibilityMatch = compatibilityMenuKeyByPrefix.find((item) => pathname.startsWith(item.prefix));
  if (compatibilityMatch) {
    return compatibilityMatch.key;
  }

  return routeMenuEntries.find((item) => pathname.startsWith(item.key))?.key ?? "/dashboard";
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const currentRoute = routeMetaByPath[location.pathname] ?? routeMetaByPath["/dashboard"];
  const selectedKey = resolveSelectedMenuKey(location.pathname);

  return (
    <Layout className="app-shell">
      <Sider
        breakpoint="lg"
        collapsedWidth={screens.xs ? 0 : 72}
        width={280}
        className="app-sidebar"
      >
        <div className="app-brand">
          <span className="app-brand-tag">Trade ERP Demo</span>
          <h1 className="app-brand-title">国际贸易 ERP 演示版</h1>
          <p className="app-brand-subtitle">核心链路真实可操作，外围模块成熟展示</p>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={routeMenuItems}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>

      <Layout className="app-content-layout">
        <Header className="app-header">
          <div>
            <Typography.Title level={1} className="app-header-title">
              {currentRoute.title}
            </Typography.Title>
            <p className="app-header-subtitle">{currentRoute.subtitle}</p>
          </div>

          <div className="app-header-panel">
            <span className="app-header-panel-label">当前演示版本</span>
            <span className="app-header-panel-value">14 项 ERP 菜单已启用，核心真实闭环持续接入</span>
            <Space wrap>
              <Tag color="processing">React + Vite</Tag>
              <Tag color="success">SQLite + Prisma</Tag>
              <Tag color="warning">双击 BAT 预览</Tag>
            </Space>
          </div>
        </Header>

        <Content>
          <div className="app-page">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
