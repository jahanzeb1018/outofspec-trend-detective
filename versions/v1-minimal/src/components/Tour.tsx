import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { TOURS } from "../content/tours";

const TourCtx = createContext<{ start: (id: string) => void } | null>(null);
export const useTour = () => useContext(TourCtx)!;

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<{ id: string; i: number } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = state ? TOURS[state.id].steps[state.i] : null;

  const start = useCallback((id: string) => setState({ id, i: 0 }), []);
  useEffect(() => {
    if (!step) return;
    navigate(step.route);
    let tries = 0;
    const t = setInterval(() => {
      const el = step.selector ? document.querySelector(step.selector) : null;
      if (el || tries++ > 30) {
        clearInterval(t);
        if (el) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          setTimeout(() => setRect(el.getBoundingClientRect()), 250);
        } else setRect(null);
      }
    }, 120);
    return () => clearInterval(t);
  }, [step, navigate]);
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const total = state ? TOURS[state.id].steps.length : 0;
  const pos = rect
    ? { top: Math.min(window.innerHeight - 220, rect.bottom + 10), left: Math.max(10, Math.min(window.innerWidth - 360, rect.left)) }
    : { top: 100, left: Math.max(10, window.innerWidth / 2 - 170) };
  return (
    <TourCtx.Provider value={{ start }}>
      {children}
      {state && step && (
        <>
          {rect && <div className="tour-hl" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />}
          <div className="tour-pop" role="dialog" aria-label={`Tour step ${state.i + 1} of ${total}`} style={pos}>
            <div className="eyebrow">
              {TOURS[state.id].title} · {state.i + 1}/{total}
            </div>
            <h3>{step.title}</h3>
            <p className="small">{step.text}</p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn small ghost" onClick={() => setState(null)}>
                End tour
              </button>
              <div className="row">
                <button className="btn small" disabled={state.i === 0} onClick={() => setState({ ...state, i: state.i - 1 })}>
                  Back
                </button>
                {state.i < total - 1 ? (
                  <button className="btn small primary" onClick={() => setState({ ...state, i: state.i + 1 })}>
                    Next
                  </button>
                ) : (
                  <button className="btn small primary" onClick={() => setState(null)}>
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </TourCtx.Provider>
  );
}
