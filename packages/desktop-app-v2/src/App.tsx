import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ShellLayout } from "./components/ShellLayout";
import { UiStateProvider } from "./state/ui-state";
import { DashboardRoute } from "./routes/DashboardRoute";
import { DashboardPreviewRoute } from "./routes/DashboardPreviewRoute";

function hasElectronRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const electronWindow = window as Window & { require?: unknown };
  return typeof electronWindow.require === "function";
}

export default function App() {
  const electronRuntimeAvailable = hasElectronRuntime();
  const defaultRoute = electronRuntimeAvailable ? "/dashboard" : "/dashboard-preview";

  return (
    <UiStateProvider>
      <HashRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route index element={<Navigate to={defaultRoute} replace />} />
            <Route path="/dashboard" element={electronRuntimeAvailable ? <DashboardRoute /> : <DashboardPreviewRoute />} />
            <Route path="/dashboard-preview" element={<DashboardPreviewRoute />} />
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </UiStateProvider>
  );
}