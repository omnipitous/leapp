import { SessionStatus } from "../../../../core/src/models/session-status";
import awsProviderIcon from "../../../../desktop-app/src/assets/images/aws-dark.png";
import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { formatStartedAt, getStatusLabel, getStatusTone } from "../../routes/use-dashboard-workspace";

type SessionRowProps = {
  row: DashboardWorkspaceModel["sessionRows"][number];
  actions: DashboardWorkspaceModel["actions"];
};

export function SessionRow({ row, actions }: SessionRowProps) {
  const { session } = row;
  const displaySubline = row.displayName !== session.sessionName ? session.sessionName : null;
  const statusTone = getStatusTone(session.status);

  return (
    <li className={row.isSelected ? "session-row session-row--selected" : "session-row"}>
      <button className="session-row__grid" type="button" aria-pressed={row.isSelected} onClick={() => actions.selectSession(session.sessionId)}>
        <span className="session-row__cell session-row__cell--session">
          <img className="session-row__provider-icon" src={awsProviderIcon} alt="" />
          <span className="session-row__session-stack">
            <span className="session-row__headline">{row.displayName}</span>
            {displaySubline ? <span className="session-row__subline">{displaySubline}</span> : null}
          </span>
        </span>

        <span className="session-row__cell">
          <span className="session-row__headline">{row.identityLabel}</span>
          {row.identityHint ? <span className="session-row__detail">{row.identityHint}</span> : null}
        </span>

        <span className="session-row__cell">
          <span className="session-provider-badge">{row.providerLabel}</span>
        </span>

        <span className="session-row__cell">
          <span className="session-row__headline">{row.profileName}</span>
        </span>

        <span className="session-row__cell">
          <span className="session-region-badge">{session.region}</span>
        </span>
      </button>

      <div className="session-row__lifecycle">
        <div className="session-row__status">
          <span className={`status-pill status-pill--${statusTone}`}>{getStatusLabel(session.status)}</span>
          <span className="session-row__started">{formatStartedAt(session.startDateTime)}</span>
        </div>

        <div className="session-row__actions">
          {session.status === SessionStatus.inactive ? (
            <button
              className="legacy-row-action legacy-row-action--primary"
              type="button"
              disabled={row.actionState.isBusy || !row.actionState.canStart}
              title={row.actionState.startReason}
              onClick={() => void actions.startSession(session.sessionId)}
            >
              <i className={row.actionState.isStarting ? "moon-Refresh legacy-row-action__spin" : "moon-Hover-Start"} aria-hidden="true" />
              <span className="sr-only">{row.actionState.isStarting ? "Starting session" : "Start session"}</span>
            </button>
          ) : (
            <button
              className="legacy-row-action"
              type="button"
              disabled={row.actionState.isBusy || !row.actionState.canStop}
              title={row.actionState.stopReason}
              onClick={() => void actions.stopSession(session.sessionId)}
            >
              <i className={row.actionState.isStopping ? "moon-Refresh legacy-row-action__spin" : "moon-Hover-Stop"} aria-hidden="true" />
              <span className="sr-only">{row.actionState.isStopping ? "Stopping session" : "Stop session"}</span>
            </button>
          )}

          <button
            className="legacy-row-action"
            type="button"
            disabled={row.actionState.isBusy || !row.actionState.canRefresh}
            title={row.actionState.refreshReason}
            onClick={() => void actions.refreshSession(session.sessionId)}
          >
            <i className={row.actionState.isRefreshing ? "moon-Refresh legacy-row-action__spin" : "moon-Refresh"} aria-hidden="true" />
            <span className="sr-only">{row.actionState.isRefreshing ? "Refreshing session" : "Refresh session"}</span>
          </button>
        </div>
      </div>
    </li>
  );
}