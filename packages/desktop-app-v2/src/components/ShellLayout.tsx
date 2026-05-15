import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useUiState } from "../state/ui-state";
import { WorkspaceRail } from "./dashboard/WorkspaceRail";

const navigation = [
  {
    to: "/dashboard",
    label: "Dashboard",
    description: "Primary workspace shell",
  },
];

export function ShellLayout() {
  const location = useLocation();
  const { compactMode, navCollapsed, toggleCompactMode, toggleNavCollapsed, resetNavigation } = useUiState();

  const dashboardShell = location.pathname.startsWith("/dashboard");

  if (!dashboardShell) {
    return (
      <div className="app-shell">
        <Outlet />
      </div>
    );
  }

  const shellClassName = compactMode ? "app-shell app-shell--dashboard app-shell--compact" : "app-shell app-shell--dashboard";

  return (
    <div className={shellClassName}>
      <WorkspaceRail
        navigation={navigation}
        compactMode={compactMode}
        navCollapsed={navCollapsed}
        toggleCompactMode={toggleCompactMode}
        toggleNavCollapsed={toggleNavCollapsed}
        resetNavigation={resetNavigation}
      />

      <section className="content-area">
        <Outlet />
      </section>
    </div>
  );
}