import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

// Register Service Worker
import '@/lib/serviceWorker';

// Amber (NIP-55) Callback-Listener initialisieren
// Fängt Deep-Link-Antworten von der Amber-App
import { initAmberCallbackListener } from '@/lib/nip55Signer';
initAmberCallbackListener();

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
