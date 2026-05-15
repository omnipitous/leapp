import { DashboardWorkspaceView } from "../components/dashboard/DashboardWorkspaceView";
import { useMockDashboardWorkspace } from "./use-dashboard-workspace";

export function DashboardPreviewRoute() {
  const workspace = useMockDashboardWorkspace();
  return <DashboardWorkspaceView workspace={workspace} />;
}