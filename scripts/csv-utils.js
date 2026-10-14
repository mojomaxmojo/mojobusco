/**
 * csv-utils.js — minimale CSV-Helfer (SEO-Nachlauf TC, 2026-10)
 *
 * Genutzt von scripts/unmapped-decision.js (Schreiben der
 * unmapped-decisions.csv) und scripts/generate-wp-redirects.js
 * (--apply-decisions: Lesen der human_decision-Spalte). Bewusst eigenständig,
 * damit der Generator NICHT unmapped-decision.js importiert (dessen main()
 * läuft beim Import — Import-Side-Effects vermeiden).
 *
 * Keine Abhängigkeiten, kein Seiteneffekt beim Import.
 */

/** Feld für CSV sicher machen (Quote bei , " \n\r). */
export function csvField(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Minimaler CSV-Parser (RFC-4180-nah: Quotes, „""“-Escapes, \r ignoriert).
 * Rückgabe: Array von Zeilen-Arrays (OHNE Header-Filter — Aufrufer prüft).
 */
export function parseCsv(text) {
  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; lines.push(row); row = []; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); lines.push(row); }
  return lines.filter(r => r.length > 1 || (r[0] || '') !== '');
}
