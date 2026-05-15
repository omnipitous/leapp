import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { DashboardCommandBar } from "./DashboardCommandBar";
import { SessionRow } from "./SessionRow";
import { WorkspaceEmptyStateSurface } from "./WorkspaceEmptyStateSurface";
import { WorkspaceStatusStrip } from "./WorkspaceStatusStrip";

const sessionWorkspaceColumns: Array<{ label: string; sortKey?: DashboardWorkspaceModel["filters"]["sortKey"] }> = [
  { label: "Session", sortKey: "name" },
  { label: "Identity" },
  { label: "Provider", sortKey: "type" },
  { label: "Named Profile", sortKey: "profile" },
  { label: "Region", sortKey: "region" },
];

type SessionWorkspaceProps = {
  snapshot: DashboardWorkspaceModel["snapshot"];
  actions: DashboardWorkspaceModel["actions"];
  filters: DashboardWorkspaceModel["filters"];
  metrics: DashboardWorkspaceModel["metrics"];
  sessionRows: DashboardWorkspaceModel["sessionRows"];
  sessionWorkspaceEmptyState: DashboardWorkspaceModel["sessionWorkspaceEmptyState"];
};

export function SessionWorkspace({ snapshot, actions, filters, metrics, sessionRows, sessionWorkspaceEmptyState }: SessionWorkspaceProps) {
  return (
    <article className="content-card session-workspace-card">
      <div className="session-workspace__heading">
        <div className="section-caption">Sessions Workspace</div>
        <div className="session-workspace__heading-meta">
          <i className="moon-Table" aria-hidden="true" />
          <span>Legacy table layout</span>
        </div>
      </div>

      <DashboardCommandBar filters={filters} actions={actions} />
      <WorkspaceStatusStrip metrics={metrics} />

      {snapshot.lastActionError ? (
        <div className="error-banner" role="alert">
          <span>{snapshot.lastActionError}</span>
          <button className="ghost-button" type="button" onClick={actions.clearLastActionError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {sessionRows.length > 0 ? (
        <>
          <div className="session-table-header" aria-hidden="true">
            <div className="session-table-header__grid">
              {sessionWorkspaceColumns.map((column) =>
                column.sortKey ? (
                  <button
                    key={column.label}
                    className={filters.sortKey === column.sortKey ? "session-table-header__button session-table-header__button--active" : "session-table-header__button"}
                    type="button"
                    onClick={() => filters.setSortKey(column.sortKey!)}
                  >
                    <span>{column.label}</span>
                    <i className={filters.sortKey === column.sortKey ? "moon-Dropdown" : "moon-Caret-down"} aria-hidden="true" />
                  </button>
                ) : (
                  <span key={column.label} className="session-table-header__label">
                    {column.label}
                  </span>
                )
              )}
            </div>

            <button
              className={filters.sortKey === "status" ? "session-table-header__button session-table-header__button--active session-table-header__actions" : "session-table-header__button session-table-header__actions"}
              type="button"
              onClick={() => filters.setSortKey("status")}
            >
              <span>Lifecycle</span>
              <i className={filters.sortKey === "status" ? "moon-Dropdown" : "moon-Caret-down"} aria-hidden="true" />
            </button>
          </div>

          <ul className="session-table" aria-label="Sessions list">
            {sessionRows.map((row) => (
              <SessionRow key={row.session.sessionId} row={row} actions={actions} />
            ))}
          </ul>
        </>
      ) : (
        <WorkspaceEmptyStateSurface state={sessionWorkspaceEmptyState} />
      )}
    </article>
  );
}