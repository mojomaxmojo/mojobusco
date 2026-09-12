import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Register Service Worker
import '@/lib/serviceWorker';

// Umami Analytics (self-hosted) – lädt nach dem kritischen Pfad (load +
// requestIdleCallback), damit Analytics nie mit FCP/LCP konkurriert.
// Siehe src/config/umami.ts → initUmamiOnIdle
import { initUmamiOnIdle } from '@/config/umami';
initUmamiOnIdle();

// Globaler Handler für unbehandelte Promise Rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Verhindert die Konsolenausgabe, wenn der Fehler bereits behandelt wurde
    event.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
