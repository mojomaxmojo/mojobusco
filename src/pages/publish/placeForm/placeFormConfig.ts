/**
 * placeFormConfig.ts — reine Konstanten des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 1), kein State,
 * keine Hooks, keine Logik-Änderungen.
 */

export const categories = [
  { value: 'campingplatz', label: 'Campingplatz', icon: '🏕️' },
  { value: 'wildcamping', label: 'Wildcamping', icon: '🌲' },
  { value: 'stellplatz', label: 'Stellplatz', icon: '🅿️' },
  { value: 'aussichtspunkt', label: 'Aussichtspunkt', icon: '👁️' },
  { value: 'strand', label: 'Strand', icon: '🏖️' },
  { value: 'berg', label: 'Berg', icon: '⛰️' }
];

export const facilityOptions = [
  'Strom', 'Wasser', 'WC', 'Dusche', 'WLAN',
  'Shop', 'Restaurant', 'Spielplatz', 'Hund erlaubt',
  'Grill', 'Feuerstelle', 'Chemie-Entsorgung'
];

export const bestForOptions = [
  'Familien', 'Paare', 'Single', 'Große Fahrzeuge',
  'Wohnmobile', 'Zelte', 'Ruhe', 'Natur',
  'Meerblick', 'Bergblick', 'Stadtnahe'
];
