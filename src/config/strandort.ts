import { ArticleCategory } from '@/config/types';

/**
 * Strand/Ort Konfiguration
 * Untermenüpunkte für Artikel: Strand, Berg, Wald, Meer, Ort
 * Bewusst unabhängig von der KI-Box (tripType, articles.js in src/config/prompts/)
 */

export const STRANDORT_CONFIG = {
  categories: {
    strand: {
      id: 'strand',
      name: 'Strand',
      description: 'Strände, Küstenabschnitte und Sandstrand-Erlebnisse',
      icon: 'Waves',
      emoji: '🏖️',
      path: '/artikel/strand-ort/strand',
      tags: {
        primary: ['strand']
      },
      color: {
        light: 'text-yellow-600',
        dark: 'text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900'
      }
    },
    berg: {
      id: 'berg',
      name: 'Berg',
      description: 'Berge, Gebirge und Aussichtspunkte',
      icon: 'Mountain',
      emoji: '⛰️',
      path: '/artikel/strand-ort/berg',
      tags: {
        primary: ['berg']
      },
      color: {
        light: 'text-stone-600',
        dark: 'text-stone-400',
        bg: 'bg-stone-100 dark:bg-stone-900'
      }
    },
    wald: {
      id: 'wald',
      name: 'Wald',
      description: 'Wälder, Wanderwege und Naturgebiete',
      icon: 'Trees',
      emoji: '🌲',
      path: '/artikel/strand-ort/wald',
      tags: {
        primary: ['wald']
      },
      color: {
        light: 'text-green-600',
        dark: 'text-green-400',
        bg: 'bg-green-100 dark:bg-green-900'
      }
    },
    meer: {
      id: 'meer',
      name: 'Meer',
      description: 'Meer, Küsten und maritime Erlebnisse',
      icon: 'Droplets',
      emoji: '🌊',
      path: '/artikel/strand-ort/meer',
      tags: {
        primary: ['meer']
      },
      color: {
        light: 'text-blue-600',
        dark: 'text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900'
      }
    },
    ort: {
      id: 'ort',
      name: 'Ort',
      description: 'Orte, Städte und besondere Plätze',
      icon: 'MapPin',
      emoji: '📍',
      path: '/artikel/strand-ort/ort',
      tags: {
        primary: ['ort']
      },
      color: {
        light: 'text-red-600',
        dark: 'text-red-400',
        bg: 'bg-red-100 dark:bg-red-900'
      }
    }
  }
} as const;

/**
 * ArticleCategory Array für Strand/Ort
 * Dies kann direkt in ARTICLE_CATEGORIES importiert werden
 */
export const STRANDORT_ARTICLE_CATEGORIES: ArticleCategory[] = [
  {
    id: 'strandort-strand',
    name: 'Strand',
    description: 'Strände, Küstenabschnitte und Sandstrand-Erlebnisse',
    icon: 'Waves',
    emoji: '🏖️',
    isStrandOrt: true,
    tags: {
      primary: ['strand'],
      optional: []
    },
    priority: 12
  },
  {
    id: 'strandort-berg',
    name: 'Berg',
    description: 'Berge, Gebirge und Aussichtspunkte',
    icon: 'Mountain',
    emoji: '⛰️',
    isStrandOrt: true,
    tags: {
      primary: ['berg'],
      optional: []
    },
    priority: 13
  },
  {
    id: 'strandort-wald',
    name: 'Wald',
    description: 'Wälder, Wanderwege und Naturgebiete',
    icon: 'Trees',
    emoji: '🌲',
    isStrandOrt: true,
    tags: {
      primary: ['wald'],
      optional: []
    },
    priority: 14
  },
  {
    id: 'strandort-meer',
    name: 'Meer',
    description: 'Meer, Küsten und maritime Erlebnisse',
    icon: 'Droplets',
    emoji: '🌊',
    isStrandOrt: true,
    tags: {
      primary: ['meer'],
      optional: []
    },
    priority: 15
  },
  {
    id: 'strandort-ort',
    name: 'Ort',
    description: 'Orte, Städte und besondere Plätze',
    icon: 'MapPin',
    emoji: '📍',
    isStrandOrt: true,
    tags: {
      primary: ['ort'],
      optional: []
    },
    priority: 16
  }
];

/**
 * Hilfsfunktion: Gibt Strand/Ort Kategorie anhand der ID zurück
 */
export function getStrandOrtCategoryById(id: string) {
  return Object.values(STRANDORT_CONFIG.categories).find(cat => cat.id === id);
}

export default STRANDORT_CONFIG;
