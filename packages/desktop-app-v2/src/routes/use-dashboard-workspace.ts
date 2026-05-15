import { useMemo, useState } from "react";
import { IntegrationType } from "../../../core/src/models/integration-type";
import type { Session } from "../../../core/src/models/session";
import { SessionStatus } from "../../../core/src/models/session-status";
import { SessionType } from "../../../core/src/models/session-type";
import type { DesktopRuntimeSnapshot } from "../runtime/desktop-runtime";
import { useDesktopRuntime } from "../runtime/use-desktop-runtime";

export type VisibilityFilter = "ALL" | "ACTIVE" | "PENDING" | "INACTIVE";
export type ProviderFilter =
  | "ALL"
  | "AWS"
  | SessionType.awsIamUser
  | SessionType.awsIamRoleFederated
  | SessionType.awsIamRoleChained
  | SessionType.awsSsoRole;
export type SortKey = "status" | "name" | "type" | "profile" | "region" | "started";

export type DashboardEmptyState = {
  kind: "search" | "filter" | "empty" | "generic";
  title: string;
  description?: string;
};

export type DashboardWorkspaceActions = {
  refreshWorkspaceSnapshot: () => void;
  selectSession: (sessionId: string) => void;
  clearSessionSelection: () => void;
  startSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  refreshSession: (sessionId: string) => Promise<void>;
  clearLastActionError: () => void;
};

type DashboardSessionCapability = DesktopRuntimeSnapshot["sessionCapabilities"][string];

type DashboardWorkspaceRuntime = {
  snapshot: DesktopRuntimeSnapshot;
  actions: DashboardWorkspaceActions;
};

type DashboardActionState = {
  canStart: boolean;
  startReason?: string;
  canStop: boolean;
  stopReason?: string;
  canRefresh: boolean;
  refreshReason?: string;
  isBusy: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isRefreshing: boolean;
};

export type DashboardSessionRow = {
  session: Session;
  displayName: string;
  identityLabel: string;
  identityHint: string | null;
  providerLabel: string;
  profileName: string;
  isSelected: boolean;
  actionState: DashboardActionState;
};

export type DashboardSelectedSession = {
  session: Session;
  profileName: string;
  integrationAlias: string | null;
  actionReason: string | null;
  actionState: DashboardActionState;
};

export type DashboardWorkspaceModel = {
  snapshot: DesktopRuntimeSnapshot;
  actions: DashboardWorkspaceActions;
  filters: {
    searchText: string;
    setSearchText: (value: string) => void;
    visibilityFilter: VisibilityFilter;
    setVisibilityFilter: (value: VisibilityFilter) => void;
    providerFilter: ProviderFilter;
    setProviderFilter: (value: ProviderFilter) => void;
    sortKey: SortKey;
    setSortKey: (value: SortKey) => void;
  };
  metrics: {
    awsSessionsCount: number;
    activeSessionsCount: number;
    pendingSessionsCount: number;
    activeAndPendingSessionsCount: number;
    credentialModeLabel: string;
    filteredSessionsCount: number;
    awsIntegrationsCount: number;
    workspaceStatusLabel: string;
  };
  sessionRows: DashboardSessionRow[];
  selectedSession: DashboardSelectedSession | null;
  awsIntegrations: DesktopRuntimeSnapshot["integrations"];
  sessionWorkspaceEmptyState: DashboardEmptyState | null;
  integrationEmptyState: DashboardEmptyState | null;
};

export const visibilityOptions: Array<{ value: VisibilityFilter; label: string }> = [
  { value: "ALL", label: "All sessions" },
  { value: "ACTIVE", label: "Active only" },
  { value: "PENDING", label: "Pending only" },
  { value: "INACTIVE", label: "Inactive only" },
];

export const providerOptions: Array<{ value: ProviderFilter; label: string }> = [
  { value: "AWS", label: "AWS sessions" },
  { value: "ALL", label: "All providers" },
  { value: SessionType.awsIamUser, label: "IAM User" },
  { value: SessionType.awsIamRoleFederated, label: "IAM Role Federated" },
  { value: SessionType.awsIamRoleChained, label: "IAM Role Chained" },
  { value: SessionType.awsSsoRole, label: "AWS Single Sign-On" },
];

export const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "status", label: "Status first" },
  { value: "name", label: "Name" },
  { value: "type", label: "Provider" },
  { value: "profile", label: "Named profile" },
  { value: "region", label: "Region" },
  { value: "started", label: "Last started" },
];

function createActionState(
  sessionId: string,
  busySessionId: string | null,
  busyAction: DesktopRuntimeSnapshot["busyAction"],
  capability?: DashboardSessionCapability
): DashboardActionState {
  const isBusy = busySessionId === sessionId;

  return {
    canStart: capability?.canStart ?? false,
    startReason: capability?.startReason,
    canStop: capability?.canStop ?? false,
    stopReason: capability?.stopReason,
    canRefresh: capability?.canRefresh ?? false,
    refreshReason: capability?.refreshReason,
    isBusy,
    isStarting: isBusy && busyAction === "start",
    isStopping: isBusy && busyAction === "stop",
    isRefreshing: isBusy && busyAction === "refresh",
  };
}

export function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.active:
      return "Active";
    case SessionStatus.pending:
      return "Pending";
    default:
      return "Inactive";
  }
}

export function getStatusTone(status: SessionStatus): "active" | "pending" | "inactive" {
  switch (status) {
    case SessionStatus.active:
      return "active";
    case SessionStatus.pending:
      return "pending";
    default:
      return "inactive";
  }
}

export function getProviderLabel(type: SessionType): string {
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

type AwsAccountAwareSession = Session & {
  awsAccount?: { accountName: string; accountId: string };
};

type AwsIdentityAwareSession = Session & {
  roleArn?: string;
  idpArn?: string;
  roleSessionName?: string;
  email?: string;
};

function getArnLeaf(value?: string): string | null {
  if (!value) {
    return null;
  }

  const segments = value.split(/[/:]/).filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

export function getSessionDisplayName(session: Session): string {
  const awsAccount = (session as AwsAccountAwareSession).awsAccount;
  return awsAccount?.accountName ?? session.sessionName;
}

export function getSessionIdentityLabel(session: Session): string {
  if (session.type === SessionType.awsIamUser) {
    return session.sessionName;
  }

  return getArnLeaf((session as AwsIdentityAwareSession).roleArn) ?? session.sessionName;
}

export function getSessionIdentityHint(session: Session): string | null {
  const awsAccount = (session as AwsAccountAwareSession).awsAccount;
  const identitySession = session as AwsIdentityAwareSession;

  if (session.type === SessionType.awsIamRoleFederated) {
    return getArnLeaf(identitySession.idpArn) ?? (awsAccount?.accountId ? `Account ${awsAccount.accountId}` : null);
  }

  if (session.type === SessionType.awsSsoRole) {
    return identitySession.email ?? null;
  }

  if (session.type === SessionType.awsIamRoleChained) {
    return identitySession.roleSessionName ?? (awsAccount?.accountId ? `Account ${awsAccount.accountId}` : null);
  }

  return awsAccount?.accountId ? `Account ${awsAccount.accountId}` : null;
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

export function formatStartedAt(value?: string): string {
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

function compareSessions(left: Session, right: Session, sortKey: SortKey, profilesById: Map<string, string>): number {
  if (sortKey === "name") {
    return getSessionDisplayName(left).localeCompare(getSessionDisplayName(right));
  }

  if (sortKey === "type") {
    return getProviderLabel(left.type).localeCompare(getProviderLabel(right.type));
  }

  if (sortKey === "profile") {
    return getProfileName(left, profilesById).localeCompare(getProfileName(right, profilesById));
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

function createSessionWorkspaceEmptyState(
  searchText: string,
  visibilityFilter: VisibilityFilter,
  providerFilter: ProviderFilter,
  awsSessionsCount: number
): DashboardEmptyState {
  if (searchText.trim()) {
    return {
      kind: "search",
      title: `No results found for "${searchText.trim()}".`,
      description: "Try another session name, role, email, region, or named profile.",
    };
  }

  if (visibilityFilter !== "ALL" || providerFilter !== "AWS") {
    return {
      kind: "filter",
      title: "No results found.",
      description: "Try to remove some filters.",
    };
  }

  if (awsSessionsCount === 0) {
    return {
      kind: "empty",
      title: "Start by adding your first session.",
      description: "This workspace does not expose any AWS sessions yet.",
    };
  }

  return {
    kind: "generic",
    title: "No AWS sessions available for this view.",
    description: "The current workspace state does not match the active dashboard selection.",
  };
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

function useDashboardWorkspaceModel({ snapshot, actions }: DashboardWorkspaceRuntime): DashboardWorkspaceModel {
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
  const awsSessions = useMemo(() => snapshot.sessions.filter((session) => isAwsSessionType(session.type)), [snapshot.sessions]);

  const selectedSessionId = snapshot.sessionSelections[0]?.sessionId;
  const selectedSession = useMemo(
    () => snapshot.sessions.find((session) => session.sessionId === selectedSessionId) ?? null,
    [selectedSessionId, snapshot.sessions]
  );

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
      .sort((left, right) => compareSessions(left, right, sortKey, profilesById));
  }, [profilesById, providerFilter, searchText, snapshot.sessions, sortKey, visibilityFilter]);

  const sessionRows = useMemo(
    () =>
      filteredSessions.map((session) => ({
        session,
        displayName: getSessionDisplayName(session),
        identityLabel: getSessionIdentityLabel(session),
        identityHint: getSessionIdentityHint(session),
        providerLabel: getProviderLabel(session.type),
        profileName: getProfileName(session, profilesById),
        isSelected: session.sessionId === selectedSessionId,
        actionState: createActionState(
          session.sessionId,
          snapshot.busySessionId,
          snapshot.busyAction,
          snapshot.sessionCapabilities[session.sessionId]
        ),
      })),
    [filteredSessions, profilesById, selectedSessionId, snapshot.busyAction, snapshot.busySessionId, snapshot.sessionCapabilities]
  );

  const selectedSessionDetails = useMemo<DashboardSelectedSession | null>(() => {
    if (!selectedSession) {
      return null;
    }

    const capability = snapshot.sessionCapabilities[selectedSession.sessionId];
    const actionReason =
      selectedSession.status === SessionStatus.inactive
        ? capability?.startReason ?? capability?.refreshReason ?? null
        : capability?.stopReason ?? capability?.refreshReason ?? null;

    return {
      session: selectedSession,
      profileName: getProfileName(selectedSession, profilesById),
      integrationAlias: getIntegrationAlias(selectedSession, integrationsById),
      actionReason,
      actionState: createActionState(selectedSession.sessionId, snapshot.busySessionId, snapshot.busyAction, capability),
    };
  }, [integrationsById, profilesById, selectedSession, snapshot.busyAction, snapshot.busySessionId, snapshot.sessionCapabilities]);

  const metrics = useMemo(() => {
    const activeSessionsCount = awsSessions.filter((session) => session.status === SessionStatus.active).length;
    const pendingSessionsCount = awsSessions.filter((session) => session.status === SessionStatus.pending).length;

    return {
      awsSessionsCount: awsSessions.length,
      activeSessionsCount,
      pendingSessionsCount,
      activeAndPendingSessionsCount: activeSessionsCount + pendingSessionsCount,
      credentialModeLabel: snapshot.workspaceCredentialMethod === "credential-process-method" ? "Process" : "File",
      filteredSessionsCount: sessionRows.length,
      awsIntegrationsCount: awsIntegrations.length,
      workspaceStatusLabel: snapshot.workspaceExists ? "loaded" : "missing",
    };
  }, [awsIntegrations.length, awsSessions, sessionRows.length, snapshot.workspaceCredentialMethod, snapshot.workspaceExists]);

  return {
    snapshot,
    actions,
    filters: {
      searchText,
      setSearchText,
      visibilityFilter,
      setVisibilityFilter,
      providerFilter,
      setProviderFilter,
      sortKey,
      setSortKey,
    },
    metrics,
    sessionRows,
    selectedSession: selectedSessionDetails,
    awsIntegrations,
    sessionWorkspaceEmptyState:
      sessionRows.length > 0 ? null : createSessionWorkspaceEmptyState(searchText, visibilityFilter, providerFilter, awsSessions.length),
    integrationEmptyState:
      awsIntegrations.length > 0
        ? null
        : {
            kind: "generic",
            title: "No AWS integrations configured.",
            description: "Connect an AWS SSO integration to restore the workspace context beside the sessions list.",
          },
  };
}

function createPreviewCapability(session: Session): DashboardSessionCapability {
  const isAwsSession = isAwsSessionType(session.type);
  if (!isAwsSession) {
    return {
      canStart: false,
      startReason: "This preview only covers the AWS dashboard workflow.",
      canStop: false,
      stopReason: "This preview only covers the AWS dashboard workflow.",
      canRefresh: false,
      refreshReason: "This preview only covers the AWS dashboard workflow.",
    };
  }

  return {
    canStart: true,
    canStop: true,
    canRefresh: true,
  };
}

function withPreviewDerived(snapshot: DesktopRuntimeSnapshot): DesktopRuntimeSnapshot {
  const selectedSessionId = snapshot.sessionSelections[0]?.sessionId;
  const hasSelectedSession = selectedSessionId ? snapshot.sessions.some((session) => session.sessionId === selectedSessionId) : false;

  return {
    ...snapshot,
    sessionSelections: hasSelectedSession ? snapshot.sessionSelections : [],
    sessionCapabilities: snapshot.sessions.reduce<Record<string, DashboardSessionCapability>>((accumulator, session) => {
      accumulator[session.sessionId] = createPreviewCapability(session);
      return accumulator;
    }, {}),
  };
}

function createPreviewSnapshot(): DesktopRuntimeSnapshot {
  const now = Date.now();
  const sessions = [
    {
      sessionId: "preview-iam-user",
      sessionName: "Core Platform User",
      type: SessionType.awsIamUser,
      status: SessionStatus.inactive,
      region: "us-east-1",
      startDateTime: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
      profileId: "profile-core-user",
    } as Session,
    {
      sessionId: "preview-federated",
      sessionName: "Production Federated Access",
      type: SessionType.awsIamRoleFederated,
      status: SessionStatus.active,
      region: "eu-west-1",
      startDateTime: new Date(now - 1000 * 60 * 25).toISOString(),
      profileId: "profile-federated",
      roleArn: "arn:aws:iam::111122223333:role/ProductionAdmin",
      idpArn: "arn:aws:iam::111122223333:saml-provider/Okta",
    } as Session,
    {
      sessionId: "preview-sso",
      sessionName: "Analytics SSO",
      type: SessionType.awsSsoRole,
      status: SessionStatus.pending,
      region: "us-west-2",
      startDateTime: new Date(now - 1000 * 60 * 5).toISOString(),
      profileId: "profile-sso",
      awsSsoConfigurationId: "integration-analytics",
      email: "analytics@example.com",
      roleArn: "arn:aws:iam::444455556666:role/AnalyticsReadOnly",
    } as Session,
    {
      sessionId: "preview-chained",
      sessionName: "Chained Observability",
      type: SessionType.awsIamRoleChained,
      status: SessionStatus.inactive,
      region: "ap-southeast-1",
      startDateTime: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
      profileId: "profile-chained",
      roleArn: "arn:aws:iam::777788889999:role/ObservabilityAdmin",
      roleSessionName: "preview-chained-ops",
    } as Session,
  ];

  return withPreviewDerived({
    workspaceExists: true,
    workspaceFileName: "Preview.leapp",
    defaultRegion: "eu-west-1",
    defaultLocation: "eu-west-1",
    workspaceCredentialMethod: "aws-credentials-file-method",
    sessions,
    integrations: [
      {
        id: "integration-analytics",
        alias: "Analytics Portal",
        type: IntegrationType.awsSso,
        isOnline: true,
      } as DesktopRuntimeSnapshot["integrations"][number],
      {
        id: "integration-platform",
        alias: "Platform SSO",
        type: IntegrationType.awsSso,
        isOnline: false,
      } as DesktopRuntimeSnapshot["integrations"][number],
    ],
    profiles: [
      { id: "profile-core-user", name: "core-user" },
      { id: "profile-federated", name: "production-admin" },
      { id: "profile-sso", name: "analytics-sso" },
      { id: "profile-chained", name: "observability-chained" },
    ],
    sessionSelections: [{ sessionId: "preview-federated", menuX: 0, menuY: 0, isContextualMenuOpen: false } as DesktopRuntimeSnapshot["sessionSelections"][number]],
    sessionCapabilities: {},
    busySessionId: null,
    busyAction: null,
    lastActionError: null,
  });
}

function updatePreviewSessions(snapshot: DesktopRuntimeSnapshot, sessionId: string, status: SessionStatus): DesktopRuntimeSnapshot {
  return withPreviewDerived({
    ...snapshot,
    sessions: snapshot.sessions.map((session) => {
      if (session.sessionId !== sessionId) {
        return session;
      }

      return {
        ...session,
        status,
        startDateTime: new Date().toISOString(),
      } as Session;
    }),
  });
}

export function useDashboardWorkspace(): DashboardWorkspaceModel {
  const runtime = useDesktopRuntime();
  return useDashboardWorkspaceModel({ snapshot: runtime.snapshot, actions: runtime.actions });
}

export function useMockDashboardWorkspace(): DashboardWorkspaceModel {
  const [snapshot, setSnapshot] = useState<DesktopRuntimeSnapshot>(() => createPreviewSnapshot());

  const actions: DashboardWorkspaceActions = {
    refreshWorkspaceSnapshot() {
      setSnapshot((current) => ({ ...current, lastActionError: null }));
    },
    selectSession(sessionId: string) {
      setSnapshot((current) =>
        withPreviewDerived({
          ...current,
          sessionSelections: [{ sessionId, menuX: 0, menuY: 0, isContextualMenuOpen: false } as DesktopRuntimeSnapshot["sessionSelections"][number]],
        })
      );
    },
    clearSessionSelection() {
      setSnapshot((current) => withPreviewDerived({ ...current, sessionSelections: [] }));
    },
    async startSession(sessionId: string) {
      setSnapshot((current) => withPreviewDerived({ ...current, busySessionId: sessionId, busyAction: "start" }));
      await Promise.resolve();
      setSnapshot((current) => ({ ...updatePreviewSessions(current, sessionId, SessionStatus.active), busySessionId: null, busyAction: null }));
    },
    async stopSession(sessionId: string) {
      setSnapshot((current) => withPreviewDerived({ ...current, busySessionId: sessionId, busyAction: "stop" }));
      await Promise.resolve();
      setSnapshot((current) => ({ ...updatePreviewSessions(current, sessionId, SessionStatus.inactive), busySessionId: null, busyAction: null }));
    },
    async refreshSession(sessionId: string) {
      setSnapshot((current) => withPreviewDerived({ ...current, busySessionId: sessionId, busyAction: "refresh" }));
      await Promise.resolve();
      setSnapshot((current) => ({ ...updatePreviewSessions(current, sessionId, SessionStatus.active), busySessionId: null, busyAction: null }));
    },
    clearLastActionError() {
      setSnapshot((current) => ({ ...current, lastActionError: null }));
    },
  };

  return useDashboardWorkspaceModel({ snapshot, actions });
}