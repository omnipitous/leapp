import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { WorkspaceEmptyStateSurface } from "./WorkspaceEmptyStateSurface";

type IntegrationContextPanelProps = {
  awsIntegrations: DashboardWorkspaceModel["awsIntegrations"];
  snapshot: DashboardWorkspaceModel["snapshot"];
  integrationEmptyState: DashboardWorkspaceModel["integrationEmptyState"];
};

export function IntegrationContextPanel({ awsIntegrations, snapshot, integrationEmptyState }: IntegrationContextPanelProps) {
  return (
    <aside className="highlight-card">
      <div className="section-caption">AWS Integrations</div>
      <h2>AWS SSO integrations</h2>
      <p className="page-copy">
        The dashboard now keeps AWS integrations visible beside the session list. Azure authentication and Azure editing flows stay deferred until the AWS path is closed.
      </p>

      {awsIntegrations.length > 0 ? (
        <ul className="integration-list" aria-label="Integrations list">
          {awsIntegrations.map((integration) => (
            <li key={integration.id} className="integration-item">
              <div>
                <div className="integration-item__title">{integration.alias}</div>
                <div className="integration-item__meta">{integration.type}</div>
              </div>
              <span className={integration.isOnline ? "integration-state integration-state--online" : "integration-state integration-state--offline"}>
                {integration.isOnline ? "Online" : "Offline"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <WorkspaceEmptyStateSurface state={integrationEmptyState} />
      )}

      <dl className="runtime-facts detail-list">
        <div>
          <dt>Workspace file</dt>
          <dd>{snapshot.workspaceFileName}</dd>
        </div>
        <div>
          <dt>Default region</dt>
          <dd>{snapshot.defaultRegion}</dd>
        </div>
        <div>
          <dt>Default location</dt>
          <dd>{snapshot.defaultLocation}</dd>
        </div>
      </dl>
    </aside>
  );
}