/**
 * Assistant-Cache-Konstanten (dual-world: Frontend + Server, kein Build).
 *
 * Muster wie src/config/api-auth.js — bewusst .js, damit der Node-Server
 * (ai-api) die Datei ohne Build-Schritt importieren kann und das Frontend
 * dieselbe Single Source liest.
 *
 * 90 Tage statt 30: Suchvolumina ändern sich monatsweise, nicht täglich —
 * ein 3-Monats-Fenster deckt genau die Länge eines Contentplans (8 Wochen
 * + Reserve). Schützt DataForSEO-Credits und Ideen-Runs: gleicher Seed =
 * 3 Monate gratis statt 1. Übersteuerbar via ASSISTANT_TOPICS_CACHE_DAYS
 * (ai-api.env) und `refresh=1` am Endpoint (manuelle Frisch-Anfrage).
 */

export const TOPICS_CACHE_DAYS = 90
