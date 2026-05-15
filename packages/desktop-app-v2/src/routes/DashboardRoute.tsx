import { useUiState } from "../state/ui-state";
import { useDesktopRuntime } from "../runtime/use-desktop-runtime";

const checkpoints = [
  "Workspace and sessions are now read through a framework-agnostic runtime adapter.",
  "The adapter constructs core services without Angular DI.",
  "The dashboard can already trigger a core-backed action path from the renderer.",
];

export function DashboardRoute() {
  const { compactMode, navCollapsed } = useUiState();
  const { snapshot, actions } = useDesktopRuntime();

  const selectedSessionId = snapshot.sessionSelections[0]?.sessionId;
  const selectedSession = snapshot.sessions.find((session) => session.sessionId === selectedSessionId);
  const previewSessions = snapshot.sessions.slice(0, 5);

  return (
    <main className="page-panel">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">Dashboard Shell</div>
          <h1>Foundation route aligned with the simplified product scope.</h1>
          <p className="page-copy">
            This screen is the only frontend entrypoint now in scope. The renderer is focused on the operational workspace surface and can already read the persisted workspace through a React-friendly adapter layer.
          </p>
        </div>
        <div className="status-tag">Runtime adapter live</div>
      </header>

      <section className="panel-grid" aria-label="Foundation metrics">
        <article className="metric-card">
          <div className="metric-label">Sessions</div>
          <div className="metric-value">{snapshot.sessions.length}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">Integrations</div>
          <div className="metric-value">{snapshot.integrations.length}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">Selected session</div>
          <div className="metric-value">{selectedSession ? selectedSession.sessionName : "None"}</div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <div className="section-caption">Current objective</div>
          <h2>Prove the first core-backed runtime slice without Angular.</h2>
          <p className="page-copy">
            The adapter reads workspace, sessions, integrations, and selection state from `@noovolari/leapp-core`, while keeping the renderer on plain React state and hooks.
          </p>

          <ul className="checkpoint-list">
            {checkpoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="runtime-actions">
            <button className="secondary-button" type="button" onClick={actions.refreshWorkspaceSnapshot}>
              Reload workspace snapshot
            </button>
            <button className="ghost-button" type="button" onClick={actions.clearSessionSelection}>
              Clear selection
            </button>
          </div>

          {previewSessions.length > 0 ? (
            <ul className="session-list" aria-label="Session preview">
              {previewSessions.map((session) => {
                const isSelected = session.sessionId === selectedSessionId;

                return (
                  <li key={session.sessionId} className="session-list__item">
                    <button className={isSelected ? "session-chip session-chip--selected" : "session-chip"} type="button" onClick={() => actions.selectSession(session.sessionId)}>
                      <span className="session-chip__name">{session.sessionName}</span>
                      <span className="session-chip__meta">{session.type ?? "unknown"} · {session.region}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="runtime-note">The adapter is active. The current workspace simply has no sessions to preview yet.</p>
          )}
        </article>

        <aside className="highlight-card">
          <div className="section-caption">Scope boundary</div>
          <h2>Session setup stays in scope.</h2>
          <p className="page-copy">
            The next slices still need the flows that let users configure integrations and start cloud sessions. Removed account and commercial surfaces do not come back into the renderer.
          </p>
          <div className="status-tag">Frontend scope simplified</div>

          <dl className="runtime-facts">
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
            <div>
              <dt>Workspace status</dt>
              <dd>{snapshot.workspaceExists ? "Loaded" : "Missing"}</dd>
            </div>
          </dl>
        </aside>

        <aside className="highlight-card">
          <div className="section-caption">Next migration slice</div>
          <h2>Runtime adapters</h2>
          <p className="page-copy">
            The next step after this check is widening the adapter layer from snapshot access to the real session and integration action flows.
          </p>
          <div className="status-tag">Section 2 candidate for check</div>
        </aside>
      </section>
    </main>
  );
}