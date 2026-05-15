import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ShellLayout } from "./components/ShellLayout";
import { UiStateProvider } from "./state/ui-state";
import { DashboardRoute } from "./routes/DashboardRoute";

export default function App() {
  return (
    <UiStateProvider>
      <HashRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </UiStateProvider>
  );
}