import { SessionStatus } from "../../../../core/src/models/session-status";
import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";

type SelectedSessionActionsBarProps = {
  selectedSession: NonNullable<DashboardWorkspaceModel["selectedSession"]>;
  actions: DashboardWorkspaceModel["actions"];
};

export function SelectedSessionActionsBar({ selectedSession, actions }: SelectedSessionActionsBarProps) {
  return (
    <div className="runtime-actions">
      {selectedSession.session.status === SessionStatus.inactive ? (
        <button
          className="primary-button"
          type="button"
          disabled={selectedSession.actionState.isBusy || !selectedSession.actionState.canStart}
          title={selectedSession.actionState.startReason}
          onClick={() => void actions.startSession(selectedSession.session.sessionId)}
        >
          {selectedSession.actionState.isStarting ? "Starting..." : "Start session"}
        </button>
      ) : (
        <button
          className="secondary-button"
          type="button"
          disabled={selectedSession.actionState.isBusy || !selectedSession.actionState.canStop}
          title={selectedSession.actionState.stopReason}
          onClick={() => void actions.stopSession(selectedSession.session.sessionId)}
        >
          {selectedSession.actionState.isStopping ? "Stopping..." : "Stop session"}
        </button>
      )}

      <button
        className="ghost-button"
        type="button"
        disabled={selectedSession.actionState.isBusy || !selectedSession.actionState.canRefresh}
        title={selectedSession.actionState.refreshReason}
        onClick={() => void actions.refreshSession(selectedSession.session.sessionId)}
      >
        {selectedSession.actionState.isRefreshing ? "Refreshing..." : "Refresh session"}
      </button>
    </div>
  );
}