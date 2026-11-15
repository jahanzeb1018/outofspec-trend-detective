// What the user is looking at (used by the Expert view drawer to show the technical detail of the same thing).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface Focus {
  cellId: string | null;
  segmentId?: string | null;
  indicator?: string;
  label?: string;
}
export type ExpertTab = "stats" | "model" | "future" | "validation" | "data";

interface Ctx {
  focus: Focus;
  setFocus: (f: Focus) => void;
  expert: { open: boolean; tab: ExpertTab };
  openExpert: (tab?: ExpertTab) => void;
  closeExpert: () => void;
  setTab: (t: ExpertTab) => void;
}
const FocusCtx = createContext<Ctx | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<Focus>({ cellId: "37.50_-5.625", indicator: "HOT40", label: "Seville area" });
  const [expert, setExpert] = useState<{ open: boolean; tab: ExpertTab }>({ open: false, tab: "stats" });
  const value = useMemo<Ctx>(
    () => ({
      focus,
      setFocus,
      expert,
      openExpert: (tab) => setExpert((e) => ({ open: true, tab: tab ?? e.tab })),
      closeExpert: () => setExpert((e) => ({ ...e, open: false })),
      setTab: (tab) => setExpert((e) => ({ ...e, tab })),
    }),
    [focus, expert],
  );
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}

export const useFocus = () => {
  const c = useContext(FocusCtx);
  if (!c) throw new Error("FocusProvider missing");
  return c;
};
