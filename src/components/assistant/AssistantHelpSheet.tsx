/**
 * AssistantHelpSheet — ausführliche Anleitung zum Berichte-Assistenten.
 *
 * Sheet/Dialog (side right), geöffnet via ⓘ-Button im Assistenten-Header
 * oder den Link im „Was fließt in den Text ein?"-Popover. Enthält die
 * 10 Nutzungsschritte aller Eingabefelder, die häufigsten Fehler und den
 * Contentplan-Prompt zum Kopieren (PROMPT_CONTENTPLAN_VORLAGE.md).
 *
 * Erreichbarkeit: nur innerhalb von /veroeffentlichen (Berichte-Tab) —
 * das Formular liegt hinter dem Login, damit ist die Hilfe automatisch
 * auth-geschützt. Keine sensiblen Daten.
 */

import { useState } from 'react';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { CheckCircle, AlertTriangle, Info } from '@/lib/icons';
import { BookOpen, Copy, FileText } from 'lucide-react';
import { ASSISTANT_HELP_STEPS, ASSISTANT_HELP_MISTAKES } from '@/config/assistantHelp';
import { CONTENTPLAN_PROMPT_TEMPLATE } from '@/config/contentplanPromptTemplate';

interface AssistantHelpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssistantHelpSheet({ open, onOpenChange }: AssistantHelpSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);

  const copyText = async (text: string, done: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      done();
      toast({ title: 'In die Zwischenablage kopiert' });
    } catch {
      // Fallback (Capacitor file:// / ältere WebViews): Textarea-Selektion
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        done();
        toast({ title: 'In die Zwischenablage kopiert' });
      } else {
        toast({ title: 'Kopieren fehlgeschlagen', description: 'Bitte Text manuell markieren.', variant: 'destructive' });
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Assistent · Vorschläge — Anleitung
          </SheetTitle>
          <SheetDescription>
            Step by step durch alle Eingabefelder des Berichte-Tabs — so bekommst du
            konsistent gute Artikel. Alles sind Vorschläge: du curates per Klick.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-12">
          {/* Roter Faden */}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Der rote Faden (Reihenfolge der Nutzung):</p>
            <ol className="space-y-1 text-xs">
              {ASSISTANT_HELP_STEPS.map((s) => (
                <li key={s.num} className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{s.num}.</span>
                  <span>{s.title}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 10 Schritte als native Accordions */}
          {ASSISTANT_HELP_STEPS.map((step) => (
            <details key={step.num} className="rounded-lg border group">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-accent/50 transition-colors">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {step.num}
                </span>
                <span className="flex-1 text-sm font-medium">{step.title}</span>
                <span className="text-xs text-muted-foreground">{step.duration}</span>
                <ChevronHint />
              </summary>
              <div className="space-y-3 px-3 pb-4 pt-1 text-sm">
                <p className="text-muted-foreground">{step.intro}</p>
                <ul className="space-y-2">
                  {step.fields.map((f) => (
                    <li key={f.label} className="text-xs">
                      <span className="font-medium">{f.label}:</span>{' '}
                      <span className="text-muted-foreground">{f.what}</span>
                      {f.rule && (
                        <span className="block ml-0 text-muted-foreground">→ {f.rule}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {step.tips.length > 0 && (
                  <ul className="space-y-1">
                    {step.tips.map((t) => (
                      <li key={t} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden>💡</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {step.avoid && step.avoid.length > 0 && (
                  <ul className="space-y-1">
                    {step.avoid.map((a) => (
                      <li key={a} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}

          {/* Häufigste Fehler */}
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-sm font-medium mb-2">Die 7 häufigsten Fehler</p>
            <ul className="space-y-1.5">
              {ASSISTANT_HELP_MISTAKES.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{i + 1}.</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contentplan-Prompt (PROMPT_CONTENTPLAN_VORLAGE.md) */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contentplan für einen neuen Ort
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mit einem Prompt erstellst du für jeden beliebigen Ort einen kompletten
              Contentplan (30 Artikel, 8 Wochen, Top-SEO-Briefs, FAKTEN mit Quellen).
              Block kopieren, AUSFÜLLEN-Block anpassen, in eine neue AI-Session einfügen —
              den Plan als <code>CONTENTPLAN_&lt;ort&gt;.md</code> ins Projekt-Root speichern.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(CONTENTPLAN_PROMPT_TEMPLATE, () => setCopiedPlan(true))}
              >
                {copiedPlan ? <CheckCircle className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copiedPlan ? 'Kopiert' : 'Prompt kopieren'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyText(
                  'HAUPTORT: \nGEMEINDE: \nKREIS/KONZELHO: \nREGION, LAND: \nZEITRAUM: \nBASIS: \nFOKUS (optional): \nANZAHL ARTIKEL: 30',
                  () => setCopied(true)
                )}
                title="Nur den AUSFÜLLEN-Block kopieren"
              >
                {copied ? <CheckCircle className="h-4 w-4 mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                Nur AUSFÜLLEN-Block
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Quelle: <code>PROMPT_CONTENTPLAN_VORLAGE.md</code> (Projekt-Root) · Referenz-Plan:
              <code> CONTENTPLAN_FIGUEIRA_BUDENS.md</code>
            </p>
          </div>

          {/* Verweise */}
          <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              Weiterlesen (Projekt-Root)
            </p>
            <p><code>ASSISTENT-CHEATSHEET.md</code> — Kurzreferenz & Limits (am Strand lesbar)</p>
            <p><code>FEATURE-BAND-SCHAETZUNG-PLAN.md</code> — wie die Nachfrage-Schätzung funktioniert</p>
            <p><code>MOJOBUS_CONTEXT.md</code> — Kontinuitäts-Gedächtnis & Wetter-Kontext</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Kleiner Chevron, dreht sich bei geöffnetem <details> (peer-frei via CSS). */
function ChevronHint() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
