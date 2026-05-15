export function DashboardWorkspaceHeader() {
  return (
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
  );
}