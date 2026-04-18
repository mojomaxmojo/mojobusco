import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { PageLoader } from "./components/ui/loading-spinner";

// 🔥 PERFORMANCE: Lazy Load für alle Pages
// Pages werden erst geladen, wenn sie benötigt werden
// Reduziert Initial Bundle Size und beschleunigt First Contentful Paint

const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));
const Articles = lazy(() => import("./pages/Articles").then(m => ({ default: m.default })));
const DIY = lazy(() => import("./pages/DIY").then(m => ({ default: m.DIY })));
const Leon = lazy(() => import("./pages/Leon").then(m => ({ default: m.Leon })));
const RVLife = lazy(() => import("./pages/RVLife").then(m => ({ default: m.RVLife })));
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
const ContentEditorMinimal = lazy(() => import("./components/ContentEditorMinimal").then(m => ({ default: m.ContentEditorMinimal })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const ServiceWorkerSettings = lazy(() => import("./pages/ServiceWorkerSettings").then(m => ({ default: m.ServiceWorkerSettings })));
const NIP89SetupPage = lazy(() => import("./pages/NIP89SetupPage").then(m => ({ default: m.NIP89SetupPage })));
const NIP19Page = lazy(() => import("./pages/NIP19Page").then(m => ({ default: m.NIP19Page })));
const BudgetPage = lazy(() => import("./pages/BudgetPage").then(m => ({ default: m.BudgetPage })));
const NotFound = lazy(() => import("./pages/NotFound").then(m => ({ default: m.default })));

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<PageLoader text="Seite wird geladen..." />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/artikel" element={<Articles />} />
              <Route path="/artikel/:country" element={<Articles />} />
              <Route path="/artikel/diy" element={<DIY />} />
              <Route path="/artikel/diy/:category" element={<DIY />} />
              <Route path="/artikel/leon" element={<Leon />} />
              <Route path="/artikel/rvlife" element={<RVLife />} />
              <Route path="/artikel/rvlife/:category" element={<RVLife />} />
              <Route path="/plaetze" element={<Places />} />
              <Route path="/plaetze/:country" element={<Places />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/map/trips" element={<TripsPage />} />
              <Route path="/trip/:naddr" element={<TripDetail />} />
              <Route path="/bilder" element={<Images />} />
              <Route path="/bilder/:country" element={<Images />} />
              <Route path="/bilder/natur/:category" element={<Images />} />
              <Route path="/bild/:nip19" element={<ImageDetail />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/notes/:country" element={<Notes />} />
              <Route path="/about" element={<About />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/service-worker" element={<ServiceWorkerSettings />} />
              <Route path="/settings/nostr-handler" element={<NIP89SetupPage />} />
              <Route path="/budget" element={<BudgetPage />} />
               <Route path="/veroeffentlichen" element={<Publish />} />
               <Route path="/veroeffentlichen/modern" element={<ContentEditorMinimal />} />
                <Route path="/perpetual-travelers" element={<PerpetualTravelers />} />
                <Route path="/promotion" element={<PromotionDashboard />} />
               <Route path="/:nip19" element={<NIP19Page />} />
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
