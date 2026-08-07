/**
 * AboutAdmin.tsx – Backoffice-Maske für die About-Seite
 *
 * Erlaubt Mojo/Susanne alle Texte der About-Seite via Markdown-Editoren zu ändern.
 * Speichert als Nostr kind 30078 mit d-tag "co.mojobus.app.about-page".
 * Änderungen sind sofort live auf /about – ohne Deploy.
 *
 * Route: /admin/about (Login-geschützt)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAboutContent } from '@/hooks/useAboutContent';
import { useToast } from '@/hooks/useToast';
import { AUTHORS } from '@/config/relays';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Save, Eye, Edit3, Loader2, ArrowLeft, ImageIcon,
  Sun, Compass, Zap, Heart,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// MarkdownPreview – Einfache Vorschau-Komponente
// ═══════════════════════════════════════════════════════════

function MarkdownEditor({ value, onChange, label, id, rows = 8 }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  id: string;
  rows?: number;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPreview(!preview)}
          className="text-xs gap-1"
        >
          {preview ? (
            <><Edit3 className="h-3 w-3" /> Bearbeiten</>
          ) : (
            <><Eye className="h-3 w-3" /> Vorschau</>
          )}
        </Button>
      </div>
      {preview ? (
        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none border rounded-md p-4 min-h-[120px] bg-background">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || '*Kein Inhalt*'}</ReactMarkdown>
        </div>
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SectionCard – Wrapper für Abschnitts-Karten
// ═══════════════════════════════════════════════════════════

function SectionCard({ title, icon, children }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function AboutAdmin() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    data: initialData,
    isLoading,
    canEdit,
    saving,
    saveAboutContent,
  } = useAboutContent();

  // ── Lokaler State für Editier-Daten ─────────────────────────────────────
  const [formData, setFormData] = useState(initialData);

  // Sync mit initialData wenn geladen
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // ── Login-Schutz ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({
        title: 'Login erforderlich',
        description: 'Bitte einloggen um die About-Seite zu bearbeiten.',
        variant: 'destructive',
      });
      navigate('/about');
    }
  }, [user, navigate, toast]);

  if (!user) return null;

  if (!canEdit) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-4">
          <p className="text-muted-foreground">Nur Max und Susanne können die About-Seite bearbeiten.</p>
          <Button variant="outline" onClick={() => navigate('/about')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück zur About-Seite
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Lade About-Inhalte...</span>
      </div>
    );
  }

  // ── Helper: Teil von formData aktualisieren ─────────────────────────────
  const updateHero = (field: 'title' | 'subtitle', value: string) =>
    setFormData((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }));

  const updateSection = (id: string, field: 'title' | 'content' | 'badge', value: string) =>
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));

  const updatePillar = (id: string, field: 'title' | 'content', value: string) =>
    setFormData((prev) => ({
      ...prev,
      pillars: prev.pillars.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));

  const updateTraveler = (id: string, field: 'name' | 'bio', value: string) =>
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));

  const updateTravelerBadges = (id: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      travelers: prev.travelers.map((t) =>
        t.id === id
          ? { ...t, badges: value.split(',').map((b) => b.trim()).filter(Boolean) }
          : t
      ),
    }));

  const updateContact = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, contact: { ...prev.contact, [field]: value } }));

  const updateSeo = (field: 'title' | 'description', value: string) =>
    setFormData((prev) => ({ ...prev, seo: { ...prev.seo, [field]: value } }));

  // ── Speichern ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    const success = await saveAboutContent(formData);
    if (success) {
      navigate('/about');
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen pb-16">
      <div className="container mx-auto px-4 max-w-4xl">

        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b py-3 mb-8 -mx-4 px-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/about')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">About-Seite verwalten</h1>
                <p className="text-xs text-muted-foreground">Alle Änderungen sofort live – kein Deploy nötig</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Speichern...</>
              ) : (
                <><Save className="h-4 w-4" /> Speichern</>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="hero" className="space-y-6">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="sections">Artikel</TabsTrigger>
            <TabsTrigger value="pillars">3 Säulen</TabsTrigger>
            <TabsTrigger value="travelers">Reisende</TabsTrigger>
            <TabsTrigger value="contact">Kontakt</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          {/* ═══════ HERO ═══════ */}
          <TabsContent value="hero" className="space-y-4">
            <SectionCard title="Hero-Bereich" icon={<ImageIcon className="h-4 w-4" />}>
              <p className="text-xs text-muted-foreground">
                Der Hero ist der erste Abschnitt auf der About-Seite. <code>{'{zeit}'}</code> wird automatisch durch die dynamische Zeitberechnung ersetzt.
              </p>
              <div className="space-y-2">
                <Label htmlFor="hero-title">Titel</Label>
                <Input
                  id="hero-title"
                  value={formData.hero.title}
                  onChange={(e) => updateHero('title', e.target.value)}
                />
              </div>
              <MarkdownEditor
                id="hero-subtitle"
                label="Untertitel ({zeit} = dynamische Berechnung)"
                value={formData.hero.subtitle}
                onChange={(v) => updateHero('subtitle', v)}
                rows={3}
              />
            </SectionCard>
          </TabsContent>

          {/* ═══════ SEKTIONEN ═══════ */}
          <TabsContent value="sections" className="space-y-6">
            {formData.sections.map((section) => (
              <SectionCard key={section.id} title={section.title} icon={<Heart className="h-4 w-4 text-primary" />}>
                {section.id === 'leon' && (
                  <div className="space-y-2">
                    <Label htmlFor={`badge-${section.id}`}>Badge (kleiner Untertitel)</Label>
                    <Input
                      id={`badge-${section.id}`}
                      value={section.badge || ''}
                      onChange={(e) => updateSection(section.id, 'badge', e.target.value)}
                    />
                  </div>
                )}
                {section.id === 'leon' && (
                  <div className="space-y-2">
                    <Label htmlFor={`title-${section.id}`}>Titel</Label>
                    <Input
                      id={`title-${section.id}`}
                      value={section.title}
                      onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                    />
                  </div>
                )}
                <MarkdownEditor
                  id={`content-${section.id}`}
                  label="Inhalt (Markdown)"
                  value={section.content}
                  onChange={(v) => updateSection(section.id, 'content', v)}
                  rows={12}
                />
              </SectionCard>
            ))}
          </TabsContent>

          {/* ═══════ 3 SÄULEN ═══════ */}
          <TabsContent value="pillars" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {formData.pillars.map((pillar) => (
                <SectionCard
                  key={pillar.id}
                  title={pillar.title.replace(/[🕊️🔥☀️]/g, '').trim()}
                  icon={
                    pillar.id === 'freiheit' ? <Sun className="h-4 w-4 text-primary" /> :
                    pillar.id === 'abenteuer' ? <Compass className="h-4 w-4 text-accent" /> :
                    <Zap className="h-4 w-4 text-green-500" />
                  }
                >
                  <div className="space-y-2">
                    <Label htmlFor={`pillar-title-${pillar.id}`}>Titel</Label>
                    <Input
                      id={`pillar-title-${pillar.id}`}
                      value={pillar.title}
                      onChange={(e) => updatePillar(pillar.id, 'title', e.target.value)}
                    />
                  </div>
                  <MarkdownEditor
                    id={`pillar-${pillar.id}`}
                    label="Text"
                    value={pillar.content}
                    onChange={(v) => updatePillar(pillar.id, 'content', v)}
                    rows={4}
                  />
                </SectionCard>
              ))}
            </div>
          </TabsContent>

          {/* ═══════ REISENDE ═══════ */}
          <TabsContent value="travelers" className="space-y-6">
            {formData.travelers.map((traveler) => {
              const author = AUTHORS.find((a) => a.id === traveler.id);
              return (
                <SectionCard key={traveler.id} title={traveler.name}>
                  <div className="space-y-2">
                    <Label htmlFor={`traveler-name-${traveler.id}`}>Name</Label>
                    <Input
                      id={`traveler-name-${traveler.id}`}
                      value={traveler.name}
                      onChange={(e) => updateTraveler(traveler.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono p-2 bg-muted rounded">
                    {author?.npub || ''}
                    <br />
                    {author?.nip05 || ''}
                  </div>
                  <MarkdownEditor
                    id={`traveler-bio-${traveler.id}`}
                    label="Bio (Markdown)"
                    value={traveler.bio}
                    onChange={(v) => updateTraveler(traveler.id, 'bio', v)}
                    rows={8}
                  />
                  <div className="space-y-2">
                    <Label htmlFor={`traveler-badges-${traveler.id}`}>
                      Badges (komma-getrennt, z.B. #vanlife,#beachlife)
                    </Label>
                    <Input
                      id={`traveler-badges-${traveler.id}`}
                      value={traveler.badges.join(', ')}
                      onChange={(e) => updateTravelerBadges(traveler.id, e.target.value)}
                    />
                  </div>
                  {/* Badge-Vorschau */}
                  <div className="flex flex-wrap gap-1">
                    {traveler.badges.map((b, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{b}</Badge>
                    ))}
                  </div>
                </SectionCard>
              );
            })}
          </TabsContent>

          {/* ═══════ KONTAKT ═══════ */}
          <TabsContent value="contact" className="space-y-4">
            <SectionCard title="Kontakt-Informationen">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-lightning">Lightning Address</Label>
                  <Input
                    id="contact-lightning"
                    value={formData.contact.lightning}
                    onChange={(e) => updateContact('lightning', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-nip05">NIP-05</Label>
                  <Input
                    id="contact-nip05"
                    value={formData.contact.nip05}
                    onChange={(e) => updateContact('nip05', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email-label">E-Mail Label</Label>
                  <Input
                    id="contact-email-label"
                    value={formData.contact.emailLabel}
                    onChange={(e) => updateContact('emailLabel', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email-value">E-Mail Wert</Label>
                  <Input
                    id="contact-email-value"
                    value={formData.contact.emailValue}
                    onChange={(e) => updateContact('emailValue', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-website-label">Website Label</Label>
                  <Input
                    id="contact-website-label"
                    value={formData.contact.websiteLabel}
                    onChange={(e) => updateContact('websiteLabel', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-website-value">Website Wert</Label>
                  <Input
                    id="contact-website-value"
                    value={formData.contact.websiteValue}
                    onChange={(e) => updateContact('websiteValue', e.target.value)}
                  />
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ═══════ SEO ═══════ */}
          <TabsContent value="seo" className="space-y-4">
            <SectionCard title="SEO-Meta-Daten">
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO-Titel</Label>
                <Input
                  id="seo-title"
                  value={formData.seo.title}
                  onChange={(e) => updateSeo('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-description">SEO-Beschreibung</Label>
                <Textarea
                  id="seo-description"
                  value={formData.seo.description}
                  onChange={(e) => updateSeo('description', e.target.value)}
                  rows={3}
                />
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>

        {/* Footer Save Button */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-3 -mx-4 px-4 mt-8">
          <div className="flex justify-end max-w-4xl mx-auto">
            <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Speichern...</>
              ) : (
                <><Save className="h-4 w-4" /> About-Seite speichern</>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}