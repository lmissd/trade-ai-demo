import { Grid, Layout, Menu, Space, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { routeMenuEntries, routeMenuItems, routeMetaByPath } from "../routes/routeMeta";

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const currentRoute = routeMetaByPath[location.pathname] ?? routeMetaByPath["/dashboard"];

  const selectedKey =
    routeMenuEntries.find((item) => location.pathname.startsWith(item.key))?.key ?? "/dashboard";

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
            <span className="app-header-panel-label">新版阶段 1 骨架</span>
            <span className="app-header-panel-value">14 项 ERP 菜单 + 双击 BAT 预览保留</span>
            <Space wrap>
              <Tag color="processing">React + Vite</Tag>
              <Tag color="success">ERP Menu</Tag>
              <Tag color="warning">BAT 直开浏览器</Tag>
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
