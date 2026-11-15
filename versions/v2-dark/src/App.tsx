import { lazy, Suspense, useState, type ReactNode } from "react";
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { APP_NAME } from "./config";
import { AssistantProvider } from "./ai/AssistantContext";
import { ErrorBoundary, Loading } from "./components/ui";
import { ExpertDrawer } from "./components/ExpertDrawer";
import { HelpDrawer } from "./components/HelpDrawer";
import { FocusProvider } from "./state/focus";
import { StartPage } from "./pages/Start";

const CasePage = lazy(() => import("./pages/Case").then((m) => ({ default: m.CasePage })));
const TripCasePage = lazy(() => import("./pages/TripCase").then((m) => ({ default: m.TripCasePage })));
const MapsPage = lazy(() => import("./pages/Maps").then((m) => ({ default: m.MapsPage })));
const WatchPage = lazy(() => import("./pages/Watch").then((m) => ({ default: m.WatchPage })));
const DetectivePage = lazy(() => import("./pages/Detective").then((m) => ({ default: m.DetectivePage })));
const LabPage = lazy(() => import("./pages/Lab").then((m) => ({ default: m.LabPage })));
const NetworkPage = lazy(() => import("./pages/Network2050").then((m) => ({ default: m.NetworkPage })));
const MethodsPage = lazy(() => import("./pages/Methods").then((m) => ({ default: m.MethodsPage })));
const ManagerPage = lazy(() => import("./pages/Manager").then((m) => ({ default: m.ManagerPage })));

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 17h18M3 21h18" stroke="#f0efec" strokeWidth="2" />
      <path d="M5 13c3-8 6 2 14-8" fill="none" stroke="#ff6a3d" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingTop: 44 }}>
      {children}
      <footer className="wrap note" style={{ padding: "48px 32px 32px" }}>
        NASA POWER (MERRA-2) · NASA NEX-GDDP-CMIP6 · NOAA · FRA · Open-Meteo forecast · © OpenStreetMap contributors · Natural Earth. Not an official NASA product.
      </footer>
    </div>
  );
}

/** Old links (/trip?route=…&date=…, /explore) keep working. */
function TripRedirect() {
  const [sp] = useSearchParams();
  const d = sp.get("date");
  return <Navigate replace to={`/case/trip/${sp.get("route") ?? "mad-sev"}${d ? `?date=${d}` : ""}`} />;
}
function ExploreRedirect() {
  const [sp] = useSearchParams();
  const cell = sp.get("cell");
  return <Navigate replace to={cell ? `/case/${cell}` : `/maps${sp.get("ind") ? `?ind=${sp.get("ind")}` : ""}`} />;
}

function Shell() {
  const { pathname } = useLocation();
  const [help, setHelp] = useState(false);
  const pill = ({ isActive }: { isActive: boolean }) => `pill${isActive ? " active" : ""}`;
  return (
    <>
      <Link to="/" className="hud-brand" aria-label={`${APP_NAME} — start`}>
        <Logo /> {APP_NAME}
      </Link>
      <div className="hud">
        <NavLink to="/watch" className={pill}>
          <span className="live-dot" /> Live
        </NavLink>
        <NavLink to="/maps" className={pill}>
          Maps
        </NavLink>
        <button className="round" onClick={() => setHelp(true)} aria-label="How it works">
          ?
        </button>
      </div>
      <main>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="wrap page"><Loading what="page" /></div>}>
            <Routes>
              <Route path="/" element={<StartPage />} />
              <Route path="/case/trip/:rid" element={<TripCasePage />} />
              <Route path="/case/:cid" element={<CasePage />} />
              <Route path="/maps" element={<Page><MapsPage /></Page>} />
              <Route path="/watch" element={<Page><WatchPage /></Page>} />
              <Route path="/detective" element={<Page><DetectivePage /></Page>} />
              <Route path="/lab" element={<Page><LabPage /></Page>} />
              <Route path="/network" element={<Page><NetworkPage /></Page>} />
              <Route path="/methods" element={<Page><MethodsPage /></Page>} />
              <Route path="/manager" element={<Page><ManagerPage /></Page>} />
              <Route path="/trip" element={<TripRedirect />} />
              <Route path="/explore" element={<ExploreRedirect />} />
              <Route path="*" element={<StartPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <HelpDrawer open={help} onClose={() => setHelp(false)} />
      <ExpertDrawer />
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <FocusProvider>
        <AssistantProvider>
          <Shell />
        </AssistantProvider>
      </FocusProvider>
    </HashRouter>
  );
}
