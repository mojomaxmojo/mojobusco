/**
 * prerender-content.js — Rich-Text-Render-Pfad für Prerender-HTML
 * (SEO-Runde 3, T-B3 + T-A3-d, 2026-10)
 *
 * Problem (verifiziert): Event-Texte enthalten rohe interne URLs — unklickbar
 * im Fließtext → Google extrahiert sie INKL. Interpunktion („/naddr1…)“,
 * 114× Googlebot-404) und baut KEINE internen Links. Markdown-Links
 * ([Text](https://mojobus.co/naddr1…)) wurden von stripMarkdown zu reinem
 * Text degradiert.
 *
 * Dieser Pfad rendert Event-Content zu sauberem Bot-HTML:
 *
 *   1. rewriteOrgLinks()   — gemappte .org-Links 1:1 → .co (Single Source:
 *                            org-link-rewrite.js; unmapped bleiben + Report)
 *   2. HTML-Tags strippen  — WP-migrierte Artikel können literal <p>/<a>
 *                            enthalten (sonst sichtbares „&lt;p&gt;“ im Body)
 *   3. escapeHtml          — ZUERST escapen (Injection-sicher; Abweichung von
 *                            der Task-Skizze „Linkify vor Escape“, dokumentiert
 *                            im Report: gleiche Wirkung, kein doppeltes Escape)
 *   4. Markdown-Links      — internal ([t](https://mojobus.co/…), relative,
 *                            nostr:) → <a href>; external → nur Linktext
 *                            (URL verschwindet → kein externes Extraktions-
 *                            profil; „extern unverändert“ = rohe externe
 *                            URLs bleiben Text)
 *   5. Linkify rohe URLs   — NUR interne (mojobus.co + nostr:-URIs); trailing
 *                            punctuation (T2a-Klasse ) ] } . , ; ' " ! ?) wird
 *                            vom URL-Match abgeschnitten → Google extrahiert
 *                            künftig die CLEAN-URL an der Quelle
 *   6. Struktur            — #-Headings → h2/h3, **fett** → <strong>,
 *                            Leerzeilen → Absätze
 *
 * Selbst-enthaltend bzgl. authors.json: Der einzige Import aus
 * prerender-helpers.js ist stripTrailingPartialUrl (R4/F3, reine Regex-
 * Funktion, kein authors.json-Dateizugriff) — prerender-helpers liest
 * authors.json auf Modulebene, daher MUSS der Importpfad dort laufen, wo
 * authors.json erreichbar ist (Repo/ai-api: beide ok, verifiziert über den
 * bestehenden helpers-Import in prerender-nav.js, der vom selben Bot-Pfad
 * geladen wird). Escape/Regex-Logik wird per Browser-Selftest gespiegelt
 * verifiziert.
 *
 * Einblend-Reihenfolge im Gesamt-Renderpfad (T-B3): org→co-Rewrite (hier,
 * Schritt 1; Choke-Point in prerender-static bleibt als Sicherheitsnetz —
 * gemappte URLs sind dann schon .co, kein doppelter Ersatz) → Struktur/
 * Linkify (hier) → Escape (hier, Schritt 3 im Detail oben).
 */

import { rewriteOrgLinks } from './org-link-rewrite.js';
import { stripTrailingPartialUrl } from './prerender-helpers.js';

/** Identische Semantik zu prerender-helpers.escapeHtml (Mirror, server-safe). */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Trailing-Interpunktion an einem URL-Match (gleiche Klasse wie T2a-Resolver). */
const TRAILING_PUNCT_RE = /[)\]}\.,;'"!?]+$/;

/**
 * Interne URL: https(s)://(www.)mojobus.co/… — Match-Body stoppt an
 * Whitespace/</>/Quotes/Backtick; hängende Interpunktion trennt der
 * Anchor-Builder ab (Google extrahiert künftig die clean-URL).
 */
const RAW_INTERNAL_URL_RE = /(?<!=")(?<!=')(?<!&quot;)(?<!&gt;)(?<!>)https?:\/\/(?:www\.)?mojobus\.co(?:\/[^\s<>"`]*)?/gi;

/** nostr:-URIs (naddr/note/npub/nprofile) → interne Anchors. */
const NOSTR_URI_RE = /(?<!=")(?<!=')(?<!&quot;)(?<!&gt;)(?<!>)nostr:(naddr1|note1|npub1|nprofile1)[0-9a-z]+/gi;

function isInternalHref(href) {
  if (!href) return false;
  if (/^https?:\/\/(?:www\.)?mojobus\.co/i.test(href)) return true;
  if (/^\/[^/]/.test(href)) return true;      // relative Pfad-Links
  if (/^nostr:(naddr1|note1|npub1|nprofile1)/i.test(href)) return true;
  return false;
}

function safeHref(href) {
  // Interne Ziel-URL normalisieren: nostr:-Schema → Pfad-Form.
  if (/^nostr:/i.test(href)) return href.replace(/^nostr:/i, '/');
  return href;
}

/** Anchor bauen (href + Text bereits escaped worden sein müssen — hier escapen wir selbst). */
function buildAnchor(href, text) {
  const target = safeHref(href.replace(TRAILING_PUNCT_RE, ''));
  return `<a href="${escapeHtml(target)}">${text}</a>`;
}

/**
 * Linkify NUR interner URLs im (bereits escapten) Text.
 * - Trailing-Punctuation wird vom Anchor abgetrennt (T2a-Klasse) und bleibt
 *   als Text stehen („(https://mojobus.co/x)“ → „(<a …>/x</a>)“).
 * - Bereits verlinkte URLs (href="…", href='…', &quot;-escaped, >Text) werden
 *   per Lookbehind übersprungen (kein doppeltes Wrapping).
 * @param {string} escapedText
 * @returns {string}
 */
export function linkifyInternalUrls(escapedText) {
  let out = String(escapedText ?? '').replace(RAW_INTERNAL_URL_RE, (raw) => {
    const target = raw.replace(TRAILING_PUNCT_RE, '');
    const trailing = raw.slice(target.length);
    return `<a href="${escapeHtml(target)}">${escapeHtml(target)}</a>${trailing}`;
  });
  out = out.replace(NOSTR_URI_RE, (raw) => {
    const token = raw.replace(/^nostr:/i, '');
    return `<a href="${escapeHtml('/' + token)}">${escapeHtml('/' + token)}</a>`;
  });
  return out;
}

/** HTML-Tags aus Roh-Content entfernen (WP-migrierte Artikel). */
function stripHtmlTags(raw) {
  return String(raw ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');
}

/**
 * Rendert Event-Content zu Bot-HTML (Volltext, linkified, strukturiert).
 * @param {string} content Roher Event-Content (Markdown / Text / leichtes HTML)
 * @param {{ maxChars?: number }} opts Sicherheits-Cap (Default 60000 Zeichen,
 *        hält das Artikel-HTML weit unter der 300-KB-Grenze)
 * @returns {string} HTML-Fragment (Absätze, h2/h3, strong, interne Anchors)
 */
export function renderRichText(content, opts = {}) {
  const maxChars = Number(opts.maxChars) > 0 ? Number(opts.maxChars) : 60000;

  // 1) org→co (Single Source org-link-rewrite.js; Choke-Point bleibt als Netz)
  // 2) HTML-Tags raus, Zeilenstruktur normalisieren
  // R4/F3: Nach dem Cap-Schnitt hängende PARTIELLE URLs (https?://…, nostr:…,
  // www.…) aus dem Fragment entfernen — der Cut schneidet sonst mittig durch
  // URLs (Live-Befund: 7 Muster je 14× im Prerender). Es werden auch URLs,
  // die EXAKT am Cap enden, entfernt (konservativ: nie URL-Fragment im
  // Output; vollständige URLs im Textkörper vor der Grenze bleiben).
  const raw = stripTrailingPartialUrl(
    stripHtmlTags(rewriteOrgLinks(String(content ?? ''))).slice(0, maxChars)
  );

  // 3) Escape-first: Sicherheit vor Struktur — alle Regex-Schritte unten
  //    arbeiten auf ESCAPETEM Text (md-Syntax ]( und URLs bleiben intakt).
  const escaped = escapeHtml(raw);

  // 4) Markdown-Bilder entfernen (Prerender zeigt nur das image-TAG-Bild)
  let text = escaped.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');

  // 5) Markdown-Links: internal → Anchor, external → nur Linktext
  //    (die externe URL verschwindet aus dem Text — konservativ, kein
  //    externes Link-Extraktionsprofil)
  text = text.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, label, href) => {
    if (isInternalHref(href)) {
      return `<a href="${escapeHtml(safeHref(href))}">${label}</a>`;
    }
    return label;
  });

  // 6) Rohe interne URLs + nostr:-URIs verlinken (trailing punct getrennt)
  text = linkifyInternalUrls(text);

  // 7) Inline-Formatierung: **fett** (nach Escape — Marker überleben das)
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // 8) Blöcke: Leerzeilen → Absätze; #-Zeilen → h2/h3 (h1 bleibt dem Titel)
  const blocks = text.split(/\n{2,}/);
  const htmlParts = [];
  for (const blockRaw of blocks) {
    const block = blockRaw.trim();
    if (!block) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(block);
    if (heading) {
      const level = (heading[1] !== undefined && block.match(/^#+/)[0].length === 1) ? 2 : 3;
      const inner = linkifyInternalUrls(heading[1].trim())
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      htmlParts.push(`<h${level}>${inner}</h${level}>`);
      continue;
    }
    htmlParts.push(`<p>${block.replace(/\n/g, '<br />')}</p>`);
  }
  return htmlParts.join('\n');
}
