import { ReactNode, createContext, useContext, useEffect, useMemo, useReducer } from "react";

type UiState = {
  compactMode: boolean;
  navCollapsed: boolean;
};

type UiAction =
  | { type: "toggleCompactMode" }
  | { type: "toggleNavCollapsed" }
  | { type: "resetNavigation" };

type UiStateContextValue = UiState & {
  toggleCompactMode: () => void;
  toggleNavCollapsed: () => void;
  resetNavigation: () => void;
};

const storageKey = "leapp-desktop-v2-ui-state";

const defaultState: UiState = {
  compactMode: false,
  navCollapsed: false,
};

const UiStateContext = createContext<UiStateContextValue | null>(null);

function reducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "toggleCompactMode":
      return { ...state, compactMode: !state.compactMode };
    case "toggleNavCollapsed":
      return { ...state, navCollapsed: !state.navCollapsed };
    case "resetNavigation":
      return { ...state, navCollapsed: false };
    default:
      return state;
  }
}

function readInitialState(): UiState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      return defaultState;
    }

    return { ...defaultState, ...(JSON.parse(saved) as Partial<UiState>) };
  } catch {
    return defaultState;
  }
}

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, readInitialState);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const value = useMemo<UiStateContextValue>(
    () => ({
      ...state,
      toggleCompactMode: () => dispatch({ type: "toggleCompactMode" }),
      toggleNavCollapsed: () => dispatch({ type: "toggleNavCollapsed" }),
      resetNavigation: () => dispatch({ type: "resetNavigation" }),
    }),
    [state]
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const context = useContext(UiStateContext);
  if (!context) {
    throw new Error("useUiState must be used inside UiStateProvider");
  }
  return context;
}