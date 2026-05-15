import type { DashboardEmptyState } from "../../routes/use-dashboard-workspace";
import noResultFoundImage from "../../../../desktop-app/src/assets/images/no-result-found.png";
import noResultFoundFilterImage from "../../../../desktop-app/src/assets/images/no-result-found-filter.png";
import noSessionsImage from "../../../../desktop-app/src/assets/images/no-sessions.png";

type WorkspaceEmptyStateSurfaceProps = {
  state: DashboardEmptyState | null;
};

export function WorkspaceEmptyStateSurface({ state }: WorkspaceEmptyStateSurfaceProps) {
  if (!state) {
    return null;
  }

  const imageSource =
    state.kind === "search"
      ? noResultFoundImage
      : state.kind === "filter"
        ? noResultFoundFilterImage
        : state.kind === "empty"
          ? noSessionsImage
          : null;

  return (
    <div className="workspace-empty-state" role="status">
      {imageSource ? <img className="workspace-empty-state__image" src={imageSource} alt="" /> : null}
      <h3 className="workspace-empty-state__title">{state.title}</h3>
      {state.description ? <p className="workspace-empty-state__description">{state.description}</p> : null}
    </div>
  );
}