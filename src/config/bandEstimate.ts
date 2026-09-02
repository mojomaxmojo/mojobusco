/**
 * Band-Schätzung — Frontend-Konfiguration (Anzeige im Assistenten-Block).
 *
 * Server-Gegenstück: server/config/band-estimate.js (Raster, Spread ×3,
 * Stufen-Grenzen, Saison-Regeln). Diese Datei enthält NUR Anzeige-Konstanten:
 * Stufen-Labels, Quellen-Badges (Ehrlichkeits-Gate — jede Zahl trägt ihre
 * Quelle). Keine Logik, nichts was mit dem Server auseinanderlaufen könnte.
 *
 * Plan: FEATURE-BAND-SCHAETZUNG-PLAN.md (Freigabe 2026-09-02)
 */

export interface BandStufeMeta {
  label: string;
  /** Band-Grenzen als Lesetext (für Tooltips) — hält Server-Grenzen nicht doppelt. */
  hint: string;
}

/** Stufen-Labels passend zu server/config/band-estimate.js BAND_STUFEN. */
export const BAND_STUFE_META: Record<string, BandStufeMeta> = {
  N: { label: 'Nische', hint: '20–300 Suchen/Monat' },
  M: { label: 'Mittel', hint: '300–2.000 Suchen/Monat' },
  G: { label: 'Groß', hint: '2.000–10.000 Suchen/Monat' },
  R: { label: 'Riese', hint: '10.000+ Suchen/Monat' },
};

/** Quellen-Badges: 🔬 = echt (Messung), 📊 = Flash-Schätzung (Band). */
export const BAND_SOURCE_LABELS: Record<string, string> = {
  dfs: 'DataForSEO (echt)',
  'flash-band': 'Flash-Band (Schätzung)',
  gsc: 'GSC (echt)',
};

/**
 * Hints für degradierte Band-Zeilen (Validierungsfehler serverseitig —
 * Zeile zeigt bewusst „—" statt einer erfundenen Zahl).
 */
export const BAND_DEGRADED_HINT =
  'Band-Schätzung nicht verfügbar (Validierung/Limit) — bewusst keine Zahl statt einer erfundenen.';
