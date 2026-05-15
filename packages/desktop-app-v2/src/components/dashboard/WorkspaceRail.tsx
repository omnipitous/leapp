import { NavLink } from "react-router-dom";

type WorkspaceRailEntry = {
  to: string;
  label: string;
  description: string;
};

type WorkspaceRailProps = {
  navigation: WorkspaceRailEntry[];
  compactMode: boolean;
  navCollapsed: boolean;
  toggleCompactMode: () => void;
  toggleNavCollapsed: () => void;
  resetNavigation: () => void;
};

export function WorkspaceRail({ navigation, compactMode, navCollapsed, toggleCompactMode, toggleNavCollapsed, resetNavigation }: WorkspaceRailProps) {
  return (
    <aside className="side-nav" aria-label="Application navigation">
      <div className="side-nav__brand">
        <span className="side-nav__eyebrow">Workspace Shell</span>
        <h1 className="side-nav__title">Leapp v2</h1>
        <div className="side-nav__subtitle">The frontend now starts directly from the workspace dashboard and stays focused on the operational workspace surface.</div>
      </div>

      <div className="side-nav__actions">
        <button className="ghost-button" type="button" onClick={toggleCompactMode}>
          {compactMode ? "Exit compact" : "Compact mode"}
        </button>
        <button className="ghost-button" type="button" onClick={toggleNavCollapsed}>
          {navCollapsed ? "Expand nav" : "Collapse nav"}
        </button>
      </div>

      <nav className="side-nav__links">
        {navigation.map((entry) => (
          <NavLink
            key={entry.to}
            className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
            to={entry.to}
            onClick={resetNavigation}
          >
            <span className="nav-link__label">{entry.label}</span>
            {!navCollapsed && <span className="nav-link__description">{entry.description}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="side-nav__footer">
        <div className="status-tag">Dashboard-only entrypoint</div>
      </div>
    </aside>
  );
}