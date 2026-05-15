import { useMemo, useState } from "react";
import { IntegrationType } from "../../../core/src/models/integration-type";
import type { Session } from "../../../core/src/models/session";
import { SessionStatus } from "../../../core/src/models/session-status";
import { SessionType } from "../../../core/src/models/session-type";
import { useDesktopRuntime } from "../runtime/use-desktop-runtime";

type VisibilityFilter = "ALL" | "ACTIVE" | "PENDING" | "INACTIVE";
type ProviderFilter = "ALL" | "AWS" | SessionType.awsIamUser | SessionType.awsIamRoleFederated | SessionType.awsIamRoleChained | SessionType.awsSsoRole;
type SortKey = "status" | "name" | "type" | "region" | "started";

const visibilityOptions: Array<{ value: VisibilityFilter; label: string }> = [
  { value: "ALL", label: "All sessions" },
  { value: "ACTIVE", label: "Active only" },
  { value: "PENDING", label: "Pending only" },
  { value: "INACTIVE", label: "Inactive only" },
];

const providerOptions: Array<{ value: ProviderFilter; label: string }> = [
  { value: "AWS", label: "AWS sessions" },
  { value: "ALL", label: "All providers" },
  { value: SessionType.awsIamUser, label: "IAM User" },
  { value: SessionType.awsIamRoleFederated, label: "IAM Role Federated" },
  { value: SessionType.awsIamRoleChained, label: "IAM Role Chained" },
  { value: SessionType.awsSsoRole, label: "AWS Single Sign-On" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "status", label: "Status first" },
  { value: "name", label: "Name" },
  { value: "type", label: "Provider" },
  { value: "region", label: "Region" },
  { value: "started", label: "Last started" },
];

function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.active:
      return "Active";
    case SessionStatus.pending:
      return "Pending";
    default:
      return "Inactive";
  }
}

function getStatusTone(status: SessionStatus): "active" | "pending" | "inactive" {
  switch (status) {
    case SessionStatus.active:
      return "active";
    case SessionStatus.pending:
      return "pending";
    default:
      return "inactive";
  }
}

function getProviderLabel(type: SessionType): string {
  switch (type) {
    case SessionType.azure:
      return "Azure";
    case SessionType.localstack:
      return "LocalStack";
    case SessionType.awsIamUser:
      return "IAM User";
    case SessionType.awsSsoRole:
      return "AWS SSO";
    case SessionType.awsIamRoleFederated:
      return "IAM Role Federated";
    case SessionType.awsIamRoleChained:
      return "IAM Role Chained";
    default:
      return type;
  }
}

function isAwsSessionType(type: SessionType): boolean {
  return (
    type === SessionType.awsIamUser ||
    type === SessionType.awsIamRoleFederated ||
    type === SessionType.awsIamRoleChained ||
    type === SessionType.awsSsoRole
  );
}

function getStatusSortValue(status: SessionStatus): number {
  switch (status) {
    case SessionStatus.active:
      return 0;
    case SessionStatus.pending:
      return 1;
    default:
      return 2;
  }
}

function formatStartedAt(value?: string): string {
  if (!value) {
    return "Never started";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getProfileName(session: Session, profilesById: Map<string, string>): string {
  const profileId = (session as Session & { profileId?: string }).profileId;
  if (!profileId) {
    return "No named profile";
  }

  return profilesById.get(profileId) ?? "Unknown profile";
}

function matchesSearch(session: Session, searchText: string, profileName: string): boolean {
  if (!searchText) {
    return true;
  }

  const candidateValues = [
    session.sessionName,
    session.type,
    session.region,
    profileName,
    (session as Session & { email?: string }).email,
    (session as Session & { roleArn?: string }).roleArn,
    (session as Session & { idpArn?: string }).idpArn,
    (session as Session & { roleSessionName?: string }).roleSessionName,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return candidateValues.some((value) => value.includes(searchText));
}

function matchesVisibility(session: Session, filter: VisibilityFilter): boolean {
  switch (filter) {
    case "ACTIVE":
      return session.status === SessionStatus.active;
    case "PENDING":
      return session.status === SessionStatus.pending;
    case "INACTIVE":
      return session.status === SessionStatus.inactive;
    default:
      return true;
  }
}

function compareSessions(left: Session, right: Session, sortKey: SortKey): number {
  if (sortKey === "name") {
    return left.sessionName.localeCompare(right.sessionName);
  }

  if (sortKey === "type") {
    return getProviderLabel(left.type).localeCompare(getProviderLabel(right.type));
  }

  if (sortKey === "region") {
    return left.region.localeCompare(right.region);
  }

  if (sortKey === "started") {
    const leftDate = left.startDateTime ? new Date(left.startDateTime).getTime() : 0;
    const rightDate = right.startDateTime ? new Date(right.startDateTime).getTime() : 0;
    return rightDate - leftDate;
  }

  const statusDelta = getStatusSortValue(left.status) - getStatusSortValue(right.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  return left.sessionName.localeCompare(right.sessionName);
}

function getIntegrationAlias(session: Session, integrationsById: Map<string, string>): string | null {
  if (session.type === SessionType.awsSsoRole) {
    return integrationsById.get((session as Session & { awsSsoConfigurationId?: string }).awsSsoConfigurationId ?? "") ?? null;
  }

  if (session.type === SessionType.azure) {
    return integrationsById.get((session as Session & { azureIntegrationId?: string }).azureIntegrationId ?? "") ?? null;
  }

  return null;
}

export function DashboardRoute() {
  const { snapshot, actions } = useDesktopRuntime();
  const [searchText, setSearchText] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("ALL");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("AWS");
  const [sortKey, setSortKey] = useState<SortKey>("status");

  const profilesById = useMemo(() => new Map(snapshot.profiles.map((profile) => [profile.id, profile.name])), [snapshot.profiles]);
  const integrationsById = useMemo(
    () => new Map(snapshot.integrations.map((integration) => [integration.id, integration.alias])),
    [snapshot.integrations]
  );
  const awsIntegrations = useMemo(
    () => snapshot.integrations.filter((integration) => integration.type === IntegrationType.awsSso),
    [snapshot.integrations]
  );

  const selectedSessionId = snapshot.sessionSelections[0]?.sessionId;
  const selectedSession = snapshot.sessions.find((session) => session.sessionId === selectedSessionId);
  const selectedCapabilities = selectedSession ? snapshot.sessionCapabilities[selectedSession.sessionId] : undefined;
  const selectedActionReason = selectedSession
    ? selectedSession.status === SessionStatus.inactive
      ? selectedCapabilities?.startReason ?? selectedCapabilities?.refreshReason ?? null
      : selectedCapabilities?.stopReason ?? selectedCapabilities?.refreshReason ?? null
    : null;

  const filteredSessions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return [...snapshot.sessions]
      .filter((session) => matchesVisibility(session, visibilityFilter))
      .filter((session) => {
        if (providerFilter === "ALL") {
          return true;
        }

        if (providerFilter === "AWS") {
          return isAwsSessionType(session.type);
        }

        return session.type === providerFilter;
      })
      .filter((session) => matchesSearch(session, normalizedSearch, getProfileName(session, profilesById)))
      .sort((left, right) => compareSessions(left, right, sortKey));
  }, [profilesById, providerFilter, searchText, snapshot.sessions, sortKey, visibilityFilter]);

  const awsSessions = snapshot.sessions.filter((session) => isAwsSessionType(session.type));
  const activeSessions = awsSessions.filter((session) => session.status === SessionStatus.active).length;
  const pendingSessions = awsSessions.filter((session) => session.status === SessionStatus.pending).length;
  const selectedIntegrationAlias = selectedSession ? getIntegrationAlias(selectedSession, integrationsById) : null;

  return (
    <main className="page-panel">
      <header className="page-header">
        <div>
          <div className="page-eyebrow">AWS Sessions Workspace</div>
          <h1>The React dashboard is now centered on the AWS operator path.</h1>
          <p className="page-copy">
            The section 3 slice is now explicitly focused on AWS sessions: browse the list, filter the workspace, inspect the selected context, and trigger the lifecycle actions already safe to run from the v2 runtime adapter.
          </p>
        </div>
        <div className="status-tag">AWS focus</div>
      </header>

      <section className="panel-grid" aria-label="Session workspace metrics">
        <article className="metric-card">
          <div className="metric-label">AWS sessions</div>
          <div className="metric-value">{awsSessions.length}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">AWS active / pending</div>
          <div className="metric-value">{activeSessions + pendingSessions}</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">Credential mode</div>
          <div className="metric-value">{snapshot.workspaceCredentialMethod === "credential-process-method" ? "Process" : "File"}</div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--sessions">
        <article className="content-card session-workspace-card">
          <div className="section-caption">AWS Command Bar</div>

          <div className="dashboard-toolbar">
            <label className="toolbar-field toolbar-field--wide">
              <span>Search sessions</span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Name, role, email, region, profile"
              />
            </label>

            <label className="toolbar-field">
              <span>Visibility</span>
              <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}>
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-field">
              <span>Provider</span>
              <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}>
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-field">
              <span>Order</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="status-summary" aria-label="Session visibility summary">
            <div className="summary-chip">Showing {filteredSessions.length} sessions</div>
            <div className="summary-chip">{awsIntegrations.length} AWS integrations loaded</div>
            <div className="summary-chip">Workspace {snapshot.workspaceExists ? "loaded" : "missing"}</div>
          </div>

          <div className="runtime-actions">
            <button className="secondary-button" type="button" onClick={actions.refreshWorkspaceSnapshot}>
              Reload workspace
            </button>
            <button className="ghost-button" type="button" onClick={actions.clearSessionSelection}>
              Clear selection
            </button>
          </div>

          {snapshot.lastActionError ? (
            <div className="error-banner" role="alert">
              <span>{snapshot.lastActionError}</span>
              <button className="ghost-button" type="button" onClick={actions.clearLastActionError}>
                Dismiss
              </button>
            </div>
          ) : null}

          {filteredSessions.length > 0 ? (
            <ul className="session-table" aria-label="Sessions list">
              {filteredSessions.map((session) => {
                const isSelected = session.sessionId === selectedSessionId;
                const capability = snapshot.sessionCapabilities[session.sessionId];
                const isBusy = snapshot.busySessionId === session.sessionId;
                const profileName = getProfileName(session, profilesById);

                return (
                  <li key={session.sessionId} className={isSelected ? "session-row session-row--selected" : "session-row"}>
                    <button className="session-row__summary" type="button" onClick={() => actions.selectSession(session.sessionId)}>
                      <span className="session-row__name">{session.sessionName}</span>
                      <span className="session-row__meta">
                        {getProviderLabel(session.type)} · {profileName} · {session.region}
                      </span>
                    </button>

                    <div className="session-row__status">
                      <span className={`status-pill status-pill--${getStatusTone(session.status)}`}>{getStatusLabel(session.status)}</span>
                      <span className="session-row__started">{formatStartedAt(session.startDateTime)}</span>
                    </div>

                    <div className="session-row__actions">
                      {session.status === SessionStatus.inactive ? (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={isBusy || !capability?.canStart}
                          title={capability?.startReason}
                          onClick={() => void actions.startSession(session.sessionId)}
                        >
                          {isBusy && snapshot.busyAction === "start" ? "Starting..." : "Start"}
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={isBusy || !capability?.canStop}
                          title={capability?.stopReason}
                          onClick={() => void actions.stopSession(session.sessionId)}
                        >
                          {isBusy && snapshot.busyAction === "stop" ? "Stopping..." : "Stop"}
                        </button>
                      )}

                      <button
                        className="ghost-button"
                        type="button"
                        disabled={isBusy || !capability?.canRefresh}
                        title={capability?.refreshReason}
                        onClick={() => void actions.refreshSession(session.sessionId)}
                      >
                        {isBusy && snapshot.busyAction === "refresh" ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
              <p className="runtime-note">No AWS sessions match the current search and filter combination.</p>
          )}
        </article>

        <div className="sidebar-stack">
          <aside className="highlight-card session-sidebar">
            <div className="section-caption">Selection Sidebar</div>
            {selectedSession ? (
              <>
                <h2>{selectedSession.sessionName}</h2>
                <p className="page-copy">
                  {getProviderLabel(selectedSession.type)} in {selectedSession.region}. Use this panel for the selected session context and the AWS lifecycle actions already wired in the v2 runtime.
                </p>

                <div className="runtime-actions">
                  {selectedSession.status === SessionStatus.inactive ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={snapshot.busySessionId === selectedSession.sessionId || !selectedCapabilities?.canStart}
                      title={selectedCapabilities?.startReason}
                      onClick={() => void actions.startSession(selectedSession.sessionId)}
                    >
                      {snapshot.busySessionId === selectedSession.sessionId && snapshot.busyAction === "start" ? "Starting..." : "Start session"}
                    </button>
                  ) : (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={snapshot.busySessionId === selectedSession.sessionId || !selectedCapabilities?.canStop}
                      title={selectedCapabilities?.stopReason}
                      onClick={() => void actions.stopSession(selectedSession.sessionId)}
                    >
                      {snapshot.busySessionId === selectedSession.sessionId && snapshot.busyAction === "stop" ? "Stopping..." : "Stop session"}
                    </button>
                  )}

                  <button
                    className="ghost-button"
                    type="button"
                    disabled={snapshot.busySessionId === selectedSession.sessionId || !selectedCapabilities?.canRefresh}
                    title={selectedCapabilities?.refreshReason}
                    onClick={() => void actions.refreshSession(selectedSession.sessionId)}
                  >
                    {snapshot.busySessionId === selectedSession.sessionId && snapshot.busyAction === "refresh" ? "Refreshing..." : "Refresh session"}
                  </button>
                </div>

                {selectedActionReason ? (
                  <p className="action-note">{selectedActionReason}</p>
                ) : null}

                <dl className="runtime-facts detail-list">
                  <div>
                    <dt>Status</dt>
                    <dd>{getStatusLabel(selectedSession.status)}</dd>
                  </div>
                  <div>
                    <dt>Profile</dt>
                    <dd>{getProfileName(selectedSession, profilesById)}</dd>
                  </div>
                  <div>
                    <dt>Provider</dt>
                    <dd>{getProviderLabel(selectedSession.type)}</dd>
                  </div>
                  <div>
                    <dt>Integration</dt>
                    <dd>{selectedIntegrationAlias ?? "Not linked"}</dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{formatStartedAt(selectedSession.startDateTime)}</dd>
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
              <p className="runtime-note">This workspace currently has no AWS integrations configured.</p>
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
        </div>
      </section>
    </main>
  );
}