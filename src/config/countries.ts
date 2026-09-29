import { Country } from '@/config/types';

export const COUNTRIES: Record<string, Country> = {
  portugal: {
    code: 'portugal',
    name: 'Portugal',
    flag: '🇵🇹',
    keywords: ['portugal', 'portugiesisch', 'lisboa', 'lisbon', 'porto', 'algarve', 'faro', 'madeira'],
    cities: ['lisbon', 'lisboa', 'porto', 'faros', 'albufeira', 'funchal'],
    regions: {
      'norden': ['porto', 'braga', 'vila-real'],
      'centro': ['lisbon', 'coimbra', 'aveiro'],
      'alentejo': ['évora', 'beja', 'portalegre'],
      'algarve': ['faro', 'albufeira', 'lagos', 'vilamoura']
    },
    coordinates: {
      bounds: { north: 42.0, south: 36.9, east: -6.1, west: -9.6 },
      center: { lat: 39.3999, lng: -8.2245 }
    },
    routes: {
      articles: '/artikel/portugal',
      places: '/plaetze/portugal',
      images: '/bilder/portugal',
      notes: '/notes/portugal'
    }
  },
  spanien: {
    code: 'spanien',
    name: 'Spanien',
    flag: '🇪🇸',
    keywords: ['spanien', 'spanisch', 'espana', 'barcelona', 'madrid', 'valencia', 'andalusien', 'sevilla'],
    cities: ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'palma', 'bilbao'],
    regions: {
      'andalusien': ['sevilla', 'malaga', 'granada', 'córdoba'],
      'katalonien': ['barcelona', 'tarragona', 'lleida', 'girona'],
      'madrid': ['madrid'],
      'valencia': ['valencia', 'alicante', 'castellón']
    },
    coordinates: {
      bounds: { north: 43.8, south: 36.0, east: 4.3, west: -9.3 },
      center: { lat: 40.4637, lng: -3.7492 }
    },
    routes: {
      articles: '/artikel/spanien',
      places: '/plaetze/spanien',
      images: '/bilder/spanien',
      notes: '/notes/spanien'
    }
  },
  frankreich: {
    code: 'frankreich',
    name: 'Frankreich',
    flag: '🇫🇷',
    keywords: ['frankreich', 'französisch', 'paris', 'lyon', 'marseille', 'nice', 'bordeaux'],
    cities: ['paris', 'lyon', 'marseille', 'nice', 'bordeaux', 'strasbourg', 'lille'],
    regions: {
      'ile-de-france': ['paris', 'versailles'],
      'provence': ['marseille', 'nice', 'avignon', 'aix-en-provence'],
      'aquitaine': ['bordeaux', 'biarritz', 'pau'],
      'bretagne': ['rennes', 'brest', 'nantes']
    },
    coordinates: {
      bounds: { north: 51.1, south: 41.3, east: 9.6, west: -5.1 },
      center: { lat: 46.2276, lng: 2.2137 }
    },
    routes: {
      articles: '/artikel/frankreich',
      places: '/plaetze/frankreich',
      images: '/bilder/frankreich',
      notes: '/notes/frankreich'
    }
  },
  belgien: {
    code: 'belgien',
    name: 'Belgien',
    flag: '🇧🇪',
    keywords: ['belgien', 'belgisch', 'brüssel', 'bruxelles', 'brussels', 'antwerpen', 'antwerp', 'gent', 'ghent'],
    cities: ['brussels', 'bruxelles', 'antwerp', 'antwerpen', 'ghent', 'gent', 'brugge', 'bruges'],
    regions: {
      'flandern': ['antwerpen', 'gent', 'brugge'],
      'wallonien': ['liège', 'namur', 'charleroi'],
      'brüssel': ['brüssel', 'bruxelles', 'brussels']
    },
    coordinates: {
      bounds: { north: 51.5, south: 49.5, east: 6.4, west: 2.5 },
      center: { lat: 50.5039, lng: 4.4699 }
    },
    routes: {
      articles: '/artikel/belgien',
      places: '/plaetze/belgien',
      images: '/bilder/belgien',
      notes: '/notes/belgien'
    }
  },
  luxemburg: {
    code: 'luxemburg',
    name: 'Luxemburg',
    flag: '🇱🇺',
    keywords: ['luxemburg', 'luxembourg', 'luxemburgisch'],
    cities: ['luxembourg', 'luxemburg', 'esch-sur-alzette'],
    regions: {
      'luxemburg-stadt': ['luxemburg', 'luxembourg'],
      'osling': ['esch-sur-alzette', 'differdange'],
      'gutland': ['echternach', 'vianden']
    },
    coordinates: {
      bounds: { north: 50.2, south: 49.4, east: 6.5, west: 5.7 },
      center: { lat: 49.8153, lng: 6.1296 }
    },
    routes: {
      articles: '/artikel/luxemburg',
      places: '/plaetze/luxemburg',
      images: '/bilder/luxemburg',
      notes: '/notes/luxemburg'
    }
  },
  deutschland: {
    code: 'deutschland',
    name: 'Deutschland',
    flag: '🇩🇪',
    keywords: ['deutschland', 'deutsch', 'germany', 'berlin', 'hamburg', 'münchen', 'munich', 'köln', 'cologne'],
    cities: ['berlin', 'hamburg', 'munich', 'münchen', 'cologne', 'köln', 'frankfurt', 'stuttgart'],
    regions: {
      'bayern': ['münchen', 'nürnberg', 'augsburg'],
      'baden-württemberg': ['stuttgart', 'freiburg', 'heidelberg'],
      'nordrhein-westfalen': ['köln', 'düsseldorf', 'dortmund'],
      'hessen': ['frankfurt', 'wiesbaden', 'kassel']
    },
    coordinates: {
      bounds: { north: 55.1, south: 47.2, east: 15.0, west: 5.9 },
      center: { lat: 51.1657, lng: 10.4515 }
    },
    routes: {
      articles: '/artikel/deutschland',
      places: '/plaetze/deutschland',
      images: '/bilder/deutschland',
      notes: '/notes/deutschland'
    }
  }
};

export default COUNTRIES;

/**
 * Länder-Tags der /veroeffentlichen-Formulare (AGENTS.md Regel 1: keine
 * hartcodierten Werte im Quellcode). Single Source — abgeleitet aus den
 * COUNTRIES-Keys. Konsumenten re-exportieren statt eigene Kopien zu pflegen:
 *   - articleFormConfig.ts  → COUNTRY_TAG_LIST (Berichte-Formular)
 *   - noteFormConstants.ts  → NOTE_COUNTRY_TAGS (Note-Formular)
 *   - usePlacePublish.ts    → Ort-Formular handleSubmit
 *   - PlaceForm.tsx         → Edit-Modus (Land aus t-Tags extrahieren)
 *
 * BEI ÄNDERUNGEN: generate-site-data.js (COUNTRIES-Objekt) spiegelt die
 * Länder-Erkennung serverseitig — Node kann die TS-Configs nicht
 * importieren, dort doppelt pflegen!
 */
export const PUBLISH_COUNTRY_TAGS = Object.keys(COUNTRIES);