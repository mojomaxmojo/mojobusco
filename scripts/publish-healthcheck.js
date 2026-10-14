#!/usr/bin/env node

/**
 * publish-healthcheck.js — Publish-Healthcheck (SEO-Fix 2026-10, T5)
 *
 * Nach jedem Publish werden die neuen naddr-URL(s) mit Googlebot-UA
 * abgefragt. Erwartung: 200 (Prerender-Datei oder Resolver-Redirect → 200).
 * Fail-Kriterien:
 *   - finaler Status ≠ 200 (z. B. 404 via Resolver, wenn kein Prerender
 *     existiert und der naddr bereits kanonisch ist)
 *   - Redirect auf die Startseite (Catch-all-Risiko)
 *   - SPA-Shell-Signatur im HTML (id="root") — Bots dürften NIE die Shell
 *     sehen (canonical=/ bzw. leeres React-Gerüst)
 *   - canonical == https://mojobus.co/ auf einer Nicht-Startseite
 *     (Sekundärsignal; T1 hat das Shell-Canonical entfernt, der Check
 *     bleibt als Gürtel+Braces für gecachte alte Shells)
 *
 * Ziel: Kein Artikel wird je als 404/Shell an Google ausgeliefert, bevor
 * der 06:00-Cron bzw. die Publish-Pipeline gelaufen ist.
 *
 * Aufruf:
 *   node scripts/publish-healthcheck.js <url> [<url> …]
 *   npm run healthcheck:publish -- <url>
 * Exit: 0 = alle grün · 1 = mind. ein Fail · 2 = Usage-Fehler
 *
 * Ohne neue Dependencies (Node 18+ global fetch). Läuft im Repo-Checkout
 * und im Webroot (deploy-main.sh kopiert scripts/ nach public/scripts/).
 */

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 15_000)
const HOME_PATHS = new Set(['/', ''])

function normalizePath(u) {
  try {
    const url = new URL(u)
    // Query für den Pfad-Vergleich ignorieren (fbclid etc.)
    return url.pathname.replace(/\/+$/, '') || '/'
  } catch {
    return u
  }
}

function isHomeUrl(u) {
  try {
    const url = new URL(u)
    return HOME_PATHS.has(url.pathname.replace(/\/+$/, ''))
  } catch {
    return false
  }
}

function shellSignature(html) {
  if (!html) return false
  // SPA-Shell: React-Mount-Point. Prerender-/Bot-HTML enthält ihn nie.
  return /<div[^>]+id=["']root["']/.test(html)
}

function homeCanonical(html) {
  const m = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/.exec(html || '')
  if (!m) return null
  try {
    const c = new URL(m[1], 'https://mojobus.invalid')
    return isHomeUrl(c.href) ? m[1] : null
  } catch {
    return null
  }
}

async function checkUrl(requestUrl) {
  const result = {
    url: requestUrl,
    ok: false,
    status: null,
    finalUrl: null,
    redirects: 0,
    reasons: [],
  }

  let res
  try {
    res = await fetch(requestUrl, {
      headers: { 'User-Agent': GOOGLEBOT_UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    result.reasons.push(`fetch fehlgeschlagen: ${e.message}`)
    return result
  }

  result.status = res.status
  result.finalUrl = res.url || requestUrl
  result.redirects = res.redirected ? 1 : 0

  if (res.status !== 200) {
    result.reasons.push(`Status ${res.status} (erwartet 200)`)
    // Body trotzdem holen? Für 404-Diagnose unnötig — direkt zurück.
    return result
  }

  const html = await res.text()

  // Redirect auf die Startseite = Catch-all (harder Constraint-Verstoß)
  if (!isHomeUrl(requestUrl) && isHomeUrl(result.finalUrl)) {
    result.reasons.push(`Redirect auf Startseite: ${result.finalUrl}`)
  }

  // SPA-Shell für Nicht-Startseiten = Bot erhielt App-Gerüst statt
  // Prerender. Die Startseite selbst DARF die Shell sein (correct delivery).
  if (!isHomeUrl(result.finalUrl) && shellSignature(html)) {
    result.reasons.push('SPA-Shell ausgeliefert (id="root") — Bot erhielt App-Gerüst statt Prerender')
  }

  const homeCanon = homeCanonical(html)
  if (homeCanon && !isHomeUrl(result.finalUrl)) {
    result.reasons.push(`Shell-Canonical auf / : ${homeCanon}`)
  }

  result.ok = result.reasons.length === 0
  return result
}

async function main() {
  const urls = process.argv.slice(2).filter(Boolean)
  if (urls.length === 0) {
    console.error('Usage: node scripts/publish-healthcheck.js <url> [<url> …]')
    console.error('Beispiel: node scripts/publish-healthcheck.js https://mojobus.co/<naddr>')
    process.exit(2)
  }

  let failed = 0
  for (const url of urls) {
    const r = await checkUrl(url)
    if (r.ok) {
      console.log(`[PublishHealthcheck] ✅ 200 ${r.url}${r.redirects ? ` (→ ${r.finalUrl})` : ''}`)
    } else {
      failed++
      // Die geforderte Logzeile — eindeutig greppbar im ai-api-/cron-Log:
      console.error(`[PublishHealthcheck] ❌ FAIL: ${r.url} → ${r.reasons.join(' | ')}`)
      if (r.status !== null) console.error(`[PublishHealthcheck]    Status: ${r.status} · Final-URL: ${r.finalUrl}`)
    }
  }

  if (failed > 0) {
    console.error(`[PublishHealthcheck] ${failed}/${urls.length} URL(s) FAILED — Artikel würde als 404/Shell an Google ausgeliefert!`)
    process.exit(1)
  }
  console.log(`[PublishHealthcheck] ✅ ${urls.length}/${urls.length} URL(s) grün`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[PublishHealthcheck] Unerwarteter Fehler:', e.message)
  process.exit(1)
})
