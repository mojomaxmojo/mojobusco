import { useSeoMeta } from "@unhead/react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  // SEO: 404-Seiten dürfen NICHT indexiert werden (Soft-404-Schutz).
  // Die URL verweigert der Bot-Resolver (@prerender_resolve) ohnehin mit
  // Status 404 — das noindex deckt den SPA-Fall für echte Nutzer ab.
  useSeoMeta({
    title: "Seite nicht gefunden — MojoBus",
    description: "Diese Seite existiert nicht. Zur Startseite von MojoBus zurückkehren.",
    robots: "noindex, follow",
  });

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">Ups! Seite nicht gefunden</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline">
          Zur Startseite
        </a>
      </div>
    </div>
  );
};

export default NotFound;
