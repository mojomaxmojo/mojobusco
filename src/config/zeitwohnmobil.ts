/**
 * Zeitwohnmobil – Konfiguration
 *
 * Anfangsdatum: Beginn des mobilen Lebens im Wohnmobil/Bus
 * Wird für Berechnungen verwendet (z.B. "X Jahre unterwegs", Tage, Monate)
 */

// Anfangsdatum: 11. Juni 2015
export const STARTDATUM = new Date('2015-06-11T00:00:00.000Z')

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Gibt die Anzahl der Tage seit dem Anfangsdatum zurück
 */
export function getTageUnterwegs(jetzt: Date = new Date()): number {
  const ms = jetzt.getTime() - STARTDATUM.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Gibt die Anzahl der vollen Monate seit dem Anfangsdatum zurück
 */
export function getMonateUnterwegs(jetzt: Date = new Date()): number {
  const jahre = jetzt.getFullYear() - STARTDATUM.getFullYear()
  const monate = jetzt.getMonth() - STARTDATUM.getMonth()
  return jahre * 12 + monate
}

/**
 * Gibt die Anzahl der vollen Jahre seit dem Anfangsdatum zurück
 */
export function getJahreUnterwegs(jetzt: Date = new Date()): number {
  return Math.floor(getTageUnterwegs(jetzt) / 365.25)
}

/**
 * Gibt eine formatierte Zusammenfassung zurück
 * z.B. "9 Jahre, 11 Monate, 3 Tage"
 */
export function getZeitUnterwegsFormatiert(jetzt: Date = new Date()): string {
  const gesamtTage = getTageUnterwegs(jetzt)
  const jahre = Math.floor(gesamtTage / 365.25)
  const restTage = gesamtTage - Math.floor(jahre * 365.25)
  const monate = Math.floor(restTage / 30.44)
  const tage = Math.floor(restTage - monate * 30.44)
  const teile: string[] = []
  if (jahre > 0) teile.push(`${jahre} Jahr${jahre !== 1 ? 'e' : ''}`)
  if (monate > 0) teile.push(`${monate} Monat${monate !== 1 ? 'e' : ''}`)
  if (tage > 0 || teile.length === 0) teile.push(`${tage} Tag${tage !== 1 ? 'e' : ''}`)
  return teile.join(', ')
}

/**
 * Gibt das Startdatum formatiert zurück
 * z.B. "11. Juni 2015"
 */
export const STARTDATUM_FORMATIERT = STARTDATUM.toLocaleDateString('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
