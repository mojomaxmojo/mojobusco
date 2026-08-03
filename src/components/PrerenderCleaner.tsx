import { useEffect } from 'react';

/**
 * Blendet den statische Prerender-Inhalt aus, sobald React gemountet ist.
 * Wird in App.tsx eingebunden und läuft bei jedem Mount.
 */
export function PrerenderCleaner() {
  useEffect(() => {
    const el = document.getElementById('prerendered-content');
    if (!el) return;

    // Sanftes Ausblenden, um harte Sprünge zu vermeiden
    el.style.transition = 'opacity 200ms ease';
    el.style.opacity = '0';

    const timer = setTimeout(() => {
      el.remove();
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
