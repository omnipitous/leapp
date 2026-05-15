import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";

type WorkspaceMetricsPanelProps = {
  metrics: DashboardWorkspaceModel["metrics"];
};

export function WorkspaceMetricsPanel({ metrics }: WorkspaceMetricsPanelProps) {
  return (
    <section className="panel-grid" aria-label="Session workspace metrics">
      <article className="metric-card">
        <div className="metric-label">AWS sessions</div>
        <div className="metric-value">{metrics.awsSessionsCount}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">AWS active / pending</div>
        <div className="metric-value">{metrics.activeAndPendingSessionsCount}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Credential mode</div>
        <div className="metric-value">{metrics.credentialModeLabel}</div>
      </article>
    </section>
  );
}