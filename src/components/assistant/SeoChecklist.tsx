/**
 * SeoChecklist — Live-Ampel für die wichtigsten Google-Kriterien.
 *
 * Reine Frontend-Berechnung (kein Server), informell — KEIN Publish-Gate
 * (das bleibt die Erlebnisse-Checkbox). Bewertet die EFFEKTIVEN Werte,
 * d. h. mit den Fallbacks, die beim Publish/Render tatsächlich greifen
 * (seo_title || Titel, meta_description || Summary, slug || buildSmartSlug).
 *
 * Genutzt im SeoPublishPanel (Berichte-Tab + Ort-Tab).
 */

import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import { SITE_URL } from '@/config/app';

export interface SeoChecklistInput {
  /** seo_title || Titel — was wirklich in <title>/og:title landet */
  effectiveTitle: string;
  /** meta_description || Summary — was wirklich zur Description wird */
  effectiveDescription: string;
  /** slug || buildSmartSlug(titel) — was wirklich als slug-Tag gesetzt wird */
  effectiveSlug: string;
  /** Editor-Markdown (für interne Links + Alt-Text-Checks) */
  content: string;
  experiencesConfirmed: boolean;
}

export type CheckStatus = 'ok' | 'warn' | 'error' | 'neutral';

export interface CheckItem {
  label: string;
  status: CheckStatus;
  detail: string;
}

const SITE_HOST = (() => {
  try { return new URL(SITE_URL).hostname; } catch { return 'mojobus.co'; }
})();

/** Zählt Markdown-Links, die intern sind (relative Pfade oder eigene Domain). */
export function countInternalLinks(content: string): number {
  const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let count = 0;
  for (const match of content.matchAll(linkRe)) {
    const url = match[1] || '';
    if (url.startsWith('/') || url.includes(SITE_HOST)) count += 1;
  }
  return count;
}

/** Zählt Markdown-Bilder total + ohne Alt-Text (![ ](...)). */
export function countImagesWithoutAlt(content: string): { total: number; withoutAlt: number } {
  const imgRe = /!\[([^\]]*)\]\(/g;
  let total = 0;
  let withoutAlt = 0;
  for (const match of content.matchAll(imgRe)) {
    total += 1;
    if (!(match[1] || '').trim()) withoutAlt += 1;
  }
  return { total, withoutAlt };
}

/** Rein funktionale Check-Berechnung (testbar, ohne React). */
export function computeSeoChecks(input: SeoChecklistInput): CheckItem[] {
  const { effectiveTitle, effectiveDescription, effectiveSlug, content, experiencesConfirmed } = input;
  const checks: CheckItem[] = [];

  // ── Titel ──────────────────────────────────────────────
  const title = effectiveTitle.trim();
  if (!title) {
    checks.push({ label: 'SEO-Titel', status: 'neutral', detail: 'Nicht gesetzt — Fallback: kreativer Titel' });
  } else if (title.length > 60) {
    checks.push({ label: 'SEO-Titel', status: 'error', detail: `${title.length}/60 Zeichen — Google kürzt mit „…"` });
  } else if (title.length < 20) {
    checks.push({ label: 'SEO-Titel', status: 'warn', detail: `${title.length}/60 Zeichen — kurz, Keywords ergänzen?` });
  } else {
    checks.push({ label: 'SEO-Titel', status: 'ok', detail: `${title.length}/60 Zeichen` });
  }

  // ── Meta-Description ───────────────────────────────────
  const desc = effectiveDescription.trim();
  if (!desc) {
    checks.push({ label: 'Meta-Description', status: 'neutral', detail: 'Nicht gesetzt — Fallback: Summary' });
  } else if (desc.length > 160) {
    checks.push({ label: 'Meta-Description', status: 'error', detail: `${desc.length}/160 Zeichen — wird abgeschnitten` });
  } else if (desc.length < 120) {
    checks.push({ label: 'Meta-Description', status: 'warn', detail: `${desc.length}/160 — kurz, Google wählt sonst selbst` });
  } else {
    checks.push({ label: 'Meta-Description', status: 'ok', detail: `${desc.length}/160 Zeichen` });
  }

  // ── Slug ───────────────────────────────────────────────
  const slug = effectiveSlug.trim();
  if (!slug) {
    checks.push({ label: 'Slug', status: 'neutral', detail: 'Nicht gesetzt' });
  } else {
    const words = slug.split('-').filter(Boolean).length;
    if (words > 6 || slug.length > 80) {
      checks.push({ label: 'Slug', status: 'warn', detail: `${words} Wörter · ${slug.length} Zeichen — kürzen empfohlen` });
    } else {
      checks.push({ label: 'Slug', status: 'ok', detail: `${words} Wörter · ${slug.length} Zeichen` });
    }
  }

  // ── Interne Links ──────────────────────────────────────
  const internal = countInternalLinks(content);
  if (internal === 0) {
    checks.push({ label: 'Interne Links', status: 'warn', detail: 'Keine — Assistent-Block „Interne Links" nutzen' });
  } else {
    checks.push({ label: 'Interne Links', status: 'ok', detail: `${internal} gesetzt` });
  }

  // ── Bilder/Alt-Texte ───────────────────────────────────
  const { total, withoutAlt } = countImagesWithoutAlt(content);
  if (total === 0) {
    checks.push({ label: 'Bilder mit Alt-Text', status: 'neutral', detail: 'Keine Bilder im Text' });
  } else if (withoutAlt > 0) {
    checks.push({ label: 'Bilder mit Alt-Text', status: 'warn', detail: `${withoutAlt} von ${total} ohne Alt-Text` });
  } else {
    checks.push({ label: 'Bilder mit Alt-Text', status: 'ok', detail: `Alle ${total} mit Alt-Text` });
  }

  // ── Erlebnisse bestätigt ───────────────────────────────
  checks.push({
    label: 'Erlebnisse bestätigt',
    status: experiencesConfirmed ? 'ok' : 'error',
    detail: experiencesConfirmed ? 'Checkbox aktiv' : 'Nicht bestätigt — Publish gesperrt',
  });

  return checks;
}

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
  neutral: MinusCircle,
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  ok: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

interface SeoChecklistProps {
  input: SeoChecklistInput;
}

export function SeoChecklist({ input }: SeoChecklistProps) {
  const checks = useMemo(() => computeSeoChecks(input), [input]);

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const relevantCount = checks.filter((c) => c.status !== 'neutral').length;

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        SEO-Check ({okCount}/{relevantCount} erfüllt) — Hinweise, keine Pflicht
      </p>
      <ul className="space-y-1">
        {checks.map((check) => {
          const Icon = STATUS_ICON[check.status];
          return (
            <li key={check.label} className="flex items-start gap-2 text-xs">
              <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${STATUS_COLOR[check.status]}`} />
              <span>
                <span className="font-medium">{check.label}:</span>{' '}
                <span className="text-muted-foreground">{check.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
