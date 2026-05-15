import type { DashboardWorkspaceModel } from "../../routes/use-dashboard-workspace";
import { providerOptions, sortOptions, visibilityOptions } from "../../routes/use-dashboard-workspace";

type DashboardCommandBarProps = {
  filters: DashboardWorkspaceModel["filters"];
  actions: DashboardWorkspaceModel["actions"];
};

export function DashboardCommandBar({ filters, actions }: DashboardCommandBarProps) {
  const hasActiveFilters = filters.visibilityFilter !== "ALL" || filters.providerFilter !== "AWS" || filters.sortKey !== "status";

  return (
    <section className={hasActiveFilters ? "legacy-command-bar legacy-command-bar--active" : "legacy-command-bar"}>
      <div className="legacy-command-bar__main">
        <div className="legacy-command-bar__leading-actions">
          <button className="legacy-icon-button" type="button" title="Reload workspace" onClick={actions.refreshWorkspaceSnapshot}>
            <i className="moon-Refresh" aria-hidden="true" />
            <span className="sr-only">Reload workspace</span>
          </button>
        </div>

        <label className="legacy-search-field">
          <span className="sr-only">Search sessions</span>
          <i className="moon-Search legacy-search-field__icon" aria-hidden="true" />
          <input
            type="search"
            value={filters.searchText}
            onChange={(event) => filters.setSearchText(event.target.value)}
            placeholder="Search session"
          />
        </label>

        <div className="legacy-command-bar__trailing-actions">
          <button className="legacy-command-bar__text-action" type="button" onClick={actions.clearSessionSelection}>
            Clear selection
          </button>
        </div>
      </div>

      <div className="legacy-command-bar__filters">
        <label className="legacy-filter-pill">
          <i className="moon-Filter legacy-filter-pill__icon" aria-hidden="true" />
          <span className="legacy-filter-pill__label">Visibility</span>
          <select value={filters.visibilityFilter} onChange={(event) => filters.setVisibilityFilter(event.target.value as typeof filters.visibilityFilter)}>
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="legacy-filter-pill">
          <i className="moon-Cloud legacy-filter-pill__icon" aria-hidden="true" />
          <span className="legacy-filter-pill__label">Provider</span>
          <select value={filters.providerFilter} onChange={(event) => filters.setProviderFilter(event.target.value as typeof filters.providerFilter)}>
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="legacy-filter-pill">
          <i className="moon-Order legacy-filter-pill__icon" aria-hidden="true" />
          <span className="legacy-filter-pill__label">Order</span>
          <select value={filters.sortKey} onChange={(event) => filters.setSortKey(event.target.value as typeof filters.sortKey)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}