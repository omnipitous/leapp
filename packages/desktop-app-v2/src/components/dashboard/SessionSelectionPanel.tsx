import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { formatStartedAt, getProviderLabel, getStatusLabel } from "../../routes/use-dashboard-workspace";
import { SelectedSessionActionsBar } from "./SelectedSessionActionsBar";

type SessionSelectionPanelProps = {
  selectedSession: DashboardWorkspaceModel["selectedSession"];
  actions: DashboardWorkspaceModel["actions"];
};

export function SessionSelectionPanel({ selectedSession, actions }: SessionSelectionPanelProps) {
  return (
    <aside className="highlight-card session-sidebar">
      <div className="section-caption">Selection Sidebar</div>
      {selectedSession ? (
        <>
          <h2>{selectedSession.session.sessionName}</h2>
          <p className="page-copy">
            {getProviderLabel(selectedSession.session.type)} in {selectedSession.session.region}. Use this panel for the selected session context and the AWS lifecycle actions already wired in the v2 runtime.
          </p>

          <SelectedSessionActionsBar selectedSession={selectedSession} actions={actions} />

          {selectedSession.actionReason ? <p className="action-note">{selectedSession.actionReason}</p> : null}

          <dl className="runtime-facts detail-list">
            <div>
              <dt>Status</dt>
              <dd>{getStatusLabel(selectedSession.session.status)}</dd>
            </div>
            <div>
              <dt>Profile</dt>
              <dd>{selectedSession.profileName}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{getProviderLabel(selectedSession.session.type)}</dd>
            </div>
            <div>
              <dt>Integration</dt>
              <dd>{selectedSession.integrationAlias ?? "Not linked"}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatStartedAt(selectedSession.session.startDateTime)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <h2>No session selected</h2>
          <p className="page-copy">
            Select an AWS session from the dashboard to inspect its context and the lifecycle actions currently in scope. Azure stays deferred, and LocalStack is no longer part of the active target.
          </p>
        </>
      )}
    </aside>
  );
}