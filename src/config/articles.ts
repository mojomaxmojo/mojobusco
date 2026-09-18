import { ArticleCategory } from '@/config/types';
import { RV_LIFE_ARTICLE_CATEGORIES } from './rvlife';
import { STRANDORT_ARTICLE_CATEGORIES } from './strandort';

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  {
    id: 'vanlife',
    name: 'Vanlife',
    description: 'Alles rund um das Leben im Van',
    icon: 'Van',
    emoji: '🚐',
    tags: {
      primary: ['vanlife'],
      optional: ['camping', 'wildcamping', 'stellplatz', 'reise']
    },
    priority: 1
  },
  {
    id: 'reisen',
    name: 'Reisen',
    description: 'Reiseberichte und -tipps',
    icon: 'Map',
    emoji: '🗺️',
    tags: {
      primary: ['reisen'],
      optional: ['route', 'grenze', 'europa', 'abenteuer']
    },
    priority: 2
  },
  {
    // LEGACY: wird im Berichte-Formular nicht mehr angeboten (kein eigener
    // Zielbereich – lief nur unter /artikel). Thematische Deckung jetzt über
    // RV Life → Freeliving/Lifestyle (config/rvlife.ts). Eintrag bleibt für
    // alte Artikel-Edits bestehen (s. ARTICLE_CATEGORY_OPTIONS in
    // src/pages/publish/articleForm/articleFormConfig.ts).
    id: 'leben',
    name: 'Lifestyle',
    description: 'Lebensstil und persönliche Themen',
    icon: 'Heart',
    emoji: '🌊',
    tags: {
      primary: ['leben'],
      optional: ['lifestyle', 'minimalismus', 'freedom', 'community']
    },
    priority: 3
  },
  {
    id: 'erfahrung',
    name: 'Erfahrungsberichte',
    description: 'Persönliche Erfahrungen und Stories',
    icon: 'BookOpen',
    emoji: '💭',
    tags: {
      primary: ['erfahrung'],
      optional: ['story', 'erlebnis', 'lernen', 'tipp']
    },
    priority: 4
  },
  {
    id: 'diy',
    name: 'DIY & Anleitungen',
    description: 'Do-it-yourself Projekte und Anleitungen',
    icon: 'Wrench',
    emoji: '🛠️',
    isDIY: true,
    tags: {
      primary: ['diy', 'anleitung'],
      optional: ['tutorial', 'guide', 'selbermachen']
    },
    priority: 5
  },
  {
    // LEGACY: wird im Berichte-Formular nicht mehr angeboten (Bereinigung
    // Kategorie-Liste, s. ARTICLE_CATEGORY_OPTIONS in
    // src/pages/publish/articleForm/articleFormConfig.ts). Eintrag bleibt
    // bestehen, damit alte Artikel mit category=technik beim Editieren
    // weiter korrekt aufgelöst werden (isDIY → #diy wird neu gesetzt).
    // Redundanz-Grund: landete ohnehin in /artikel/diy, Unterkategorie
    // „Technik & Elektronik" existiert unter DIY_CATEGORIES.
    id: 'technik',
    name: 'Technik & Solar',
    description: 'Technische Themen und Solar-Energie',
    icon: 'Zap',
    emoji: '⚡',
    isDIY: true,
    tags: {
      primary: ['technik', 'solar'],
      optional: ['elektronik', 'strom', 'photovoltaik']
    },
    priority: 6
  },
  {
    id: 'leon',
    name: 'Leon Stories',
    description: 'Geschichten und Abenteuer von Leon',
    icon: 'Dog',
    emoji: '🦁',
    isLeon: true,
    tags: {
      primary: ['leon'],
      optional: ['hund', 'abenteuer', 'vanlife-hund', 'camper-hund']
    },
    autoTags: ['leon', 'lion', 'dog'], // Automatische Tags bei Auswahl dieser Kategorie (ohne 'artikel' da das schon in required ist)
    priority: 7
  },
  ...RV_LIFE_ARTICLE_CATEGORIES,
  ...STRANDORT_ARTICLE_CATEGORIES
];

export default ARTICLE_CATEGORIES;