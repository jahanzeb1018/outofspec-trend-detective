import { lazy, Suspense } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { APP_NAME } from "./config";
import { AskBar, AssistantProvider } from "./ai/AssistantContext";
import { ErrorBoundary, Loading, Switch } from "./components/ui";
import { TourProvider } from "./components/Tour";
import { ExpertDrawer } from "./components/ExpertDrawer";
import { FocusProvider, useFocus } from "./state/focus";
import { HomePage } from "./pages/Home";

const WatchPage = lazy(() => import("./pages/Watch").then((m) => ({ default: m.WatchPage })));
const TripPage = lazy(() => import("./pages/Trip").then((m) => ({ default: m.TripPage })));
const LabPage = lazy(() => import("./pages/Lab").then((m) => ({ default: m.LabPage })));
const NetworkPage = lazy(() => import("./pages/Network2050").then((m) => ({ default: m.NetworkPage })));
const JourneyPage = lazy(() => import("./pages/Journey").then((m) => ({ default: m.JourneyPage })));
const MethodsPage = lazy(() => import("./pages/Methods").then((m) => ({ default: m.MethodsPage })));
const ManagerPage = lazy(() => import("./pages/Manager").then((m) => ({ default: m.ManagerPage })));

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 17h18M3 21h18" stroke="#0c0d0f" strokeWidth="2" />
      <path d="M5 13c3-8 6 2 14-8" fill="none" stroke="#d63a2f" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const { expert, openExpert, closeExpert } = useFocus();
  const nav: [string, string, boolean?][] = [
    ["/", "Overview"],
    ["/watch", "Heat watch", true],
    ["/trip", "My trip"],
    ["/lab", "Track lab"],
    ["/network", "2050"],
    ["/how", "How it works"],
  ];
  return (
    <>
      <header className="topbar">
        <div className="in">
          <NavLink to="/" className="brand">
            <Logo /> {APP_NAME}
          </NavLink>
          <nav className="nav" aria-label="Main">
            {nav.map(([to, label, live]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive || (to === "/" && pathname === "/explore") ? "active" : "")}>
                {live && <span className="live" aria-hidden />}
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="spacer" />
          <AskBar />
          <Switch on={expert.open} onChange={(v) => (v ? openExpert() : closeExpert())} label="Expert view" />
        </div>
      </header>
      <main>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="wrap"><Loading what="page" /></div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<HomePage />} />
              <Route path="/watch" element={<WatchPage />} />
              <Route path="/trip" element={<TripPage />} />
              <Route path="/lab" element={<LabPage />} />
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/how" element={<JourneyPage />} />
              <Route path="/methods" element={<MethodsPage />} />
              <Route path="/manager" element={<ManagerPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <div className="in">
          <span>NASA POWER (MERRA-2) · NASA NEX-GDDP-CMIP6 · NOAA · FRA · Open-Meteo forecast · © OpenStreetMap contributors · Natural Earth. Not an official NASA product.</span>
          <button className="btn ghost" style={{ padding: 0, minHeight: 0, color: "var(--ink-2)" }} onClick={() => openExpert("data")}>
            Methods, tests &amp; data — Expert view
          </button>
        </div>
      </footer>
      <ExpertDrawer />
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <FocusProvider>
        <AssistantProvider>
          <TourProvider>
            <Shell />
          </TourProvider>
        </AssistantProvider>
      </FocusProvider>
    </HashRouter>
  );
}
