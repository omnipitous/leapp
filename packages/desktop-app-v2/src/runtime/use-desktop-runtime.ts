import { useMemo, useSyncExternalStore } from "react";
import { getDesktopRuntime } from "./desktop-runtime";

export function useDesktopRuntime() {
  const runtime = useMemo(() => getDesktopRuntime(), []);
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);

  return {
    snapshot,
    actions: runtime.actions,
  };
}