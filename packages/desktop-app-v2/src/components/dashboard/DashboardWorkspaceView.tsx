import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { DashboardWorkspaceHeader } from "./DashboardWorkspaceHeader";
import { IntegrationContextPanel } from "./IntegrationContextPanel";
import { SessionSelectionPanel } from "./SessionSelectionPanel";
import { SessionWorkspace } from "./SessionWorkspace";
import { WorkspaceMetricsPanel } from "./WorkspaceMetricsPanel";

export function DashboardWorkspaceView({ workspace }: { workspace: DashboardWorkspaceModel }) {
  const { snapshot, actions, filters, metrics, sessionRows, selectedSession, awsIntegrations, sessionWorkspaceEmptyState, integrationEmptyState } =
    workspace;

  return (
    <main className="page-panel">
      <DashboardWorkspaceHeader />
      <WorkspaceMetricsPanel metrics={metrics} />

      <section className="dashboard-grid dashboard-grid--sessions">
        <SessionWorkspace
          snapshot={snapshot}
          actions={actions}
          filters={filters}
          metrics={metrics}
          sessionRows={sessionRows}
          sessionWorkspaceEmptyState={sessionWorkspaceEmptyState}
        />

        <div className="sidebar-stack">
          <SessionSelectionPanel selectedSession={selectedSession} actions={actions} />
          <IntegrationContextPanel awsIntegrations={awsIntegrations} snapshot={snapshot} integrationEmptyState={integrationEmptyState} />
        </div>
      </section>
    </main>
  );
}