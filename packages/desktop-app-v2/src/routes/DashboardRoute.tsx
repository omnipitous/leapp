import { DashboardWorkspaceView } from "../components/dashboard/DashboardWorkspaceView";
import { useDashboardWorkspace } from "./use-dashboard-workspace";

export function DashboardRoute() {
  const workspace = useDashboardWorkspace();
  return <DashboardWorkspaceView workspace={workspace} />;
}