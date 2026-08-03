import { useEffect } from 'react';

/**
 * Blendet den statische Prerender-Inhalt aus, sobald React gemountet ist.
 * Wird in App.tsx eingebunden und läuft bei jedem Mount.
 */
export function PrerenderCleaner() {
  useEffect(() => {
    const el = document.getElementById('prerendered-content');
    if (!el) return;

    // Sofort ausblenden, damit kein sichtbares Flackern entsteht.
    // Das statische HTML ist nur für den ersten Paint da; React übernimmt sofort.
    el.style.display = 'none';
    el.remove();
  }, []);

  return null;
}
