import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";

type WorkspaceStatusStripProps = {
  metrics: DashboardWorkspaceModel["metrics"];
};

export function WorkspaceStatusStrip({ metrics }: WorkspaceStatusStripProps) {
  return (
    <div className="status-summary" aria-label="Session visibility summary">
      <div className="summary-chip">Showing {metrics.filteredSessionsCount} sessions</div>
      <div className="summary-chip">{metrics.awsIntegrationsCount} AWS integrations loaded</div>
      <div className="summary-chip">Workspace {metrics.workspaceStatusLabel}</div>
    </div>
  );
}