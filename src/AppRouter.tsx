import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { Header } from "./components/Header";
import { SiteSearch } from "./components/SiteSearch";
import { Footer } from "./components/Footer";
import { PageLoader } from "./components/ui/loading-spinner";
import { Home } from "./pages/Home";

// 🔥 PERFORMANCE: Lazy Load für Pages außer Home
// Home wird eager geladen, damit der Footer auf der Landing Page sofort an der
// finalen Position gerendert wird und kein Suspense-Fallback-Shift entsteht.
// Pages werden erst geladen, wenn sie benötigt werden
// (Außnahme: Home, siehe oben – Landing Page eager für CLS-Stabilität)

const Articles = lazy(() => import("./pages/Articles").then(m => ({ default: m.default })));
const DIY = lazy(() => import("./pages/DIY").then(m => ({ default: m.DIY })));
const Leon = lazy(() => import("./pages/Leon").then(m => ({ default: m.Leon })));
const RVLife = lazy(() => import("./pages/RVLife").then(m => ({ default: m.RVLife })));
const StrandOrt = lazy(() => import("./pages/StrandOrt").then(m => ({ default: m.StrandOrt })));
const Notes = lazy(() => import("./pages/Notes").then(m => ({ default: m.Notes })));
const About = lazy(() => import("./pages/About").then(m => ({ default: m.About })));
const Places = lazy(() => import("./pages/Places").then(m => ({ default: m.default })));
const Images = lazy(() => import("./pages/Images").then(m => ({ default: m.default })));
const MapPage = lazy(() => import("./pages/MapPage").then(m => ({ default: m.default })));
const TripsPage = lazy(() => import("./pages/TripsPage").then(m => ({ default: m.default })));
const TripDetail = lazy(() => import("./pages/TripDetail").then(m => ({ default: m.default })));
const ImageDetail = lazy(() => import("./pages/ImageDetail").then(m => ({ default: m.ImageDetail })));
const Publish = lazy(() => import("./pages/Publish").then(m => ({ default: m.Publish })));
const PerpetualTravelers = lazy(() => import("./pages/PerpetualTravelers").then(m => ({ default: m.PerpetualTravelers })));
const PromotionDashboard = lazy(() => import("./pages/PromotionDashboard").then(m => ({ default: m.PromotionDashboard })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const ServiceWorkerSettings = lazy(() => import("./pages/ServiceWorkerSettings").then(m => ({ default: m.ServiceWorkerSettings })));
const NIP89SetupPage = lazy(() => import("./pages/NIP89SetupPage").then(m => ({ default: m.NIP89SetupPage })));
const NIP19Page = lazy(() => import("./pages/NIP19Page").then(m => ({ default: m.NIP19Page })));
const BudgetPage = lazy(() => import("./pages/BudgetPage").then(m => ({ default: m.BudgetPage })));
const VideoPromotion = lazy(() => import("./pages/VideoPromotion").then(m => ({ default: m.VideoPromotion })));
const AboutAdmin = lazy(() => import("./pages/admin/AboutAdmin").then(m => ({ default: m.AboutAdmin })));
const Videos = lazy(() => import("./pages/Videos").then(m => ({ default: m.Videos })));
const VideoDetail = lazy(() => import("./pages/VideoDetail").then(m => ({ default: m.VideoDetail })));
const NotFound = lazy(() => import("./pages/NotFound").then(m => ({ default: m.default })));

// Schritt 4 — Öffentliche Inhaltsseiten, die zusätzlich unter `/en/...` erreichbar
// sein müssen. Diese werden weiter unten zweimal gemappt (einmal ohne Präfix,
// einmal mit `/en`), statt jede Zeile händisch zu duplizieren. Interne
// Redaktions-Tools stehen NICHT hier und bleiben daher ohne `/en/`-Zugriff.
const PUBLIC_ROUTE_DEFINITIONS: { path: string; element: ReactElement }[] = [
  { path: "/", element: <Home /> },
  { path: "/artikel", element: <Articles /> },
  { path: "/artikel/:country", element: <Articles /> },
  { path: "/artikel/diy", element: <DIY /> },
  { path: "/artikel/diy/:category", element: <DIY /> },
  { path: "/artikel/leon", element: <Leon /> },
  { path: "/artikel/rvlife", element: <RVLife /> },
  { path: "/artikel/rvlife/:category", element: <RVLife /> },
  { path: "/artikel/strand-ort", element: <StrandOrt /> },
  { path: "/artikel/strand-ort/:category", element: <StrandOrt /> },
  { path: "/plaetze", element: <Places /> },
  { path: "/plaetze/:country", element: <Places /> },
  { path: "/map", element: <MapPage /> },
  { path: "/map/trips", element: <TripsPage /> },
  { path: "/trip/:naddr", element: <TripDetail /> },
  { path: "/bilder", element: <Images /> },
  { path: "/bilder/:country", element: <Images /> },
  { path: "/bilder/natur/:category", element: <Images /> },
  { path: "/bild/:nip19", element: <ImageDetail /> },
  { path: "/notes", element: <Notes /> },
  { path: "/notes/:country", element: <Notes /> },
  { path: "/artikel/notes", element: <Notes /> },
  { path: "/artikel/notes/:country", element: <Notes /> },
  { path: "/videos", element: <Videos /> },
  { path: "/video/:naddr", element: <VideoDetail /> },
  { path: "/about", element: <About /> },
  { path: "/:nip19", element: <NIP19Page /> },
];

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Header />
        <SiteSearch />
        <main className="flex-1">
          <Suspense fallback={<PageLoader text="Seite wird geladen..." />}>
            <Routes>
              {PUBLIC_ROUTE_DEFINITIONS.map(r => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
              {PUBLIC_ROUTE_DEFINITIONS.map(r => (
                <Route key={'en-' + r.path} path={'/en' + (r.path === '/' ? '' : r.path)} element={r.element} />
              ))}
              {/* Interne Redaktions-Tools – bewusst KEIN /en/‑Zugriff */}
               <Route path="/admin/about" element={<AboutAdmin />} />
               <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/service-worker" element={<ServiceWorkerSettings />} />
              <Route path="/settings/nostr-handler" element={<NIP89SetupPage />} />
              <Route path="/budget" element={<BudgetPage />} />
               <Route path="/veroeffentlichen" element={<Publish />} />
                <Route path="/perpetual-travelers" element={<PerpetualTravelers />} />
                <Route path="/promotion" element={<PromotionDashboard />} />
                <Route path="/promotion/tiktok" element={<VideoPromotion />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
