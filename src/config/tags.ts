import { TagGroup } from '@/config/types';

export const TAG_GROUPS: TagGroup[] = [
  {
    name: 'Länder',
    description: 'Geografische Tags für Länder und Regionen',
    tags: [
      { id: 'portugal', label: 'Portugal', icon: '🇵🇹' },
      { id: 'spanien', label: 'Spanien', icon: '🇪🇸' },
      { id: 'italien', label: 'Italien', icon: '🇮🇹' },
      { id: 'frankreich', label: 'Frankreich', icon: '🇫🇷' },
      { id: 'deutschland', label: 'Deutschland', icon: '🇩🇪' },
      { id: 'belgien', label: 'Belgien', icon: '🇧🇪' },
      { id: 'luxemburg', label: 'Luxemburg', icon: '🇱🇺' }
    ]
  },
  {
    name: 'RV Life',
    description: 'RV Life spezifische Tags für Wohnmobil-Leben',
    tags: [
      { id: 'rvlife', label: 'RV Life', icon: '🚐' },
      { id: 'rv-life', label: 'RV Life', icon: '🚐' },
      { id: 'wohnmobil', label: 'Wohnmobil', icon: '🏠' },
      { id: 'camper', label: 'Camper', icon: '🚐' }
    ]
  },
  {
    name: 'Küche & Essen',
    description: 'Kochen, Backen und Essen',
    tags: [
      { id: 'kueche', label: 'Küche', icon: '🍳' },
      { id: 'essen', label: 'Essen', icon: '🍽️' },
      { id: 'cooking', label: 'Kochen', icon: '🍳' },
      { id: 'food', label: 'Food', icon: '🍕' },
      { id: 'kochen', label: 'Kochen', icon: '🍳' },
      { id: 'backen', label: 'Backen', icon: '🧁' },
      { id: 'rezepte', label: 'Rezepte', icon: '📖' },
      { id: 'kochgeraete', label: 'Kochgeräte', icon: '🍳' },
      { id: 'kuechenausstattung', label: 'Küchenausstattung', icon: '🔪' },
      { id: 'ersatznahrung', label: 'Ersatznahrung', icon: '🥫' },
      { id: 'camping-kueche', label: 'Camping-Küche', icon: '🏕️' },
      { id: 'kuechen-inspiration', label: 'Küchen-Inspiration', icon: '✨' }
    ]
  },
  {
    name: 'Ausstattung',
    description: 'Wohnen, Küche, Bad und Storage',
    tags: [
      { id: 'ausstattung', label: 'Ausstattung', icon: '🏠' },
      { id: 'equipment', label: 'Equipment', icon: '⚙️' },
      { id: 'ausruestung', label: 'Ausrüstung', icon: '🎒' },
      { id: 'wohnen', label: 'Wohnen', icon: '🏡' },
      { id: 'kuechenausstattung', label: 'Küchenausstattung', icon: '🍳' },
      { id: 'badausstattung', label: 'Badausstattung', icon: '🚿' },
      { id: 'storage', label: 'Storage', icon: '📦' },
      { id: 'stauraum', label: 'Stauraum', icon: '📦' },
      { id: 'moebel', label: 'Möbel', icon: '🪑' },
      { id: 'interieur', label: 'Interieur', icon: '🖼️' },
      { id: 'innenausbau', label: 'Innenausbau', icon: '🔨' },
      { id: 'wohnzimmer', label: 'Wohnzimmer', icon: '🛋️' },
      { id: 'schlafbereich', label: 'Schlafbereich', icon: '🛏️' },
      { id: 'aufbewahrung', label: 'Aufbewahrung', icon: '🗃️' }
    ]
  },
  {
    name: 'Freeliving',
    description: 'Nomadenleben und Freiheit',
    tags: [
      { id: 'freeliving', label: 'Freeliving', icon: '🕊️' },
      { id: 'nomad', label: 'Nomad', icon: '🧭' },
      { id: 'freedom', label: 'Freedom', icon: '🕊️' },
      { id: 'nomadenleben', label: 'Nomadenleben', icon: '🌍' },
      { id: 'digital-nomad', label: 'Digital Nomad', icon: '💻' },
      { id: 'ortsunabhaengig', label: 'Ortsunabhängig', icon: '🌏' },
      { id: 'reisen', label: 'Reisen', icon: '✈️' },
      { id: 'freiheit', label: 'Freiheit', icon: '🦅' },
      { id: 'abenteuer', label: 'Abenteuer', icon: '🏔️' },
      { id: 'minimalismus', label: 'Minimalismus', icon: '🧘' },
      { id: 'community', label: 'Community', icon: '👥' },
      { id: 'unabhaengigkeit', label: 'Unabhängigkeit', icon: '🚀' },
      { id: 'leben-auf-radiern', label: 'Leben auf Rädern', icon: '🚐' }
    ]
  },
  {
    name: 'Vanlife',
    description: 'Vanlife-spezifische Tags',
    tags: [
      { id: 'camping', label: 'Camping', icon: '🏕️' },
      { id: 'wildcamping', label: 'Wildcamping', icon: '🌲' },
      { id: 'stellplatz', label: 'Stellplatz', icon: '🅿️' },
      { id: 'digital-nomade', label: 'Digital Nomade', icon: '💻' },
      { id: 'vanlife', label: 'Vanlife', icon: '🚐' },
      { id: 'wohnmobil', label: 'Wohnmobil', icon: '🏠' },
      { id: 'zelt', label: 'Zelt', icon: '⛺' }
    ]
  },
  {
    name: 'Technik',
    description: 'Technische und solar-bezogene Tags',
    tags: [
      { id: 'solarenergie', label: 'Solarenergie', icon: '☀️' },
      { id: 'batterie', label: 'Batterie', icon: '🔋' },
      { id: 'strom', label: 'Strom', icon: '⚡' },
      { id: 'internet', label: 'Internet', icon: '📡' },
      { id: 'navigation', label: 'Navigation', icon: '🗺️' },
      { id: 'reparatur', label: 'Reparatur', icon: '🔧' },
      { id: 'elektronik', label: 'Elektronik', icon: '📱' },
      { id: '12v', label: '12V System', icon: '🔌' }
    ]
  },
  {
    name: 'Lifestyle',
    description: 'Lifestyle und persönliche Tags',
    tags: [
      { id: 'kochen', label: 'Kochen', icon: '🍳' },
      { id: 'fitness', label: 'Fitness', icon: '💪' },
      { id: 'freedom', label: 'Freedom', icon: '🕊️' },
      { id: 'community', label: 'Community', icon: '👥' },
      { id: 'minimalismus', label: 'Minimalismus', icon: '🧘' },
      { id: 'sunset', label: 'Sunset', icon: '🌅' },
      { id: 'beachlife', label: 'Beachlife', icon: '🏖️' }
    ]
  },
  {
    name: 'Natur & Umwelt',
    description: 'Natur- und umweltbezogene Tags',
    tags: [
      { id: 'strand', label: 'Strand', icon: '🏖️' },
      { id: 'ocean', label: 'Ocean', icon: '🌊' },
      { id: 'berg', label: 'Berg', icon: '⛰️' },
      { id: 'natur', label: 'Natur', icon: '🌲' },
      { id: 'offgrid', label: 'Offgrid', icon: '🏡' },
      { id: 'wildnis', label: 'Wildnis', icon: '🌿' },
      { id: 'meer', label: 'Meer', icon: '🌊' },
      { id: 'kueste', label: 'Küste', icon: '🏖️' }
    ]
  },
  {
    name: 'Aktivitäten',
    description: 'Aktivitäten und Hobbys',
    tags: [
      { id: 'wandern', label: 'Wandern', icon: '🥾' },
      { id: 'surfen', label: 'Surfen', icon: '🏄' },
      { id: 'radfahren', label: 'Radfahren', icon: '🚴' },
      { id: 'klettern', label: 'Klettern', icon: '🧗' },
      { id: 'fotografie', label: 'Fotografie', icon: '📷' },
      { id: 'lesen', label: 'Lesen', icon: '📚' },
      { id: 'musik', label: 'Musik', icon: '🎵' },
      { id: 'yoga', label: 'Yoga', icon: '🧘' }
    ]
  },
  {
    name: 'Pets',
    description: 'Haustiere und Begleiter',
    tags: [
      { id: 'leon', label: 'Leon', icon: '🦁' },
      { id: 'hund', label: 'Hund', icon: '🐕' },
      { id: 'hund', label: 'Hunde', icon: '🐕‍🦺' },
      { id: 'camper-hund', label: 'Camper Hund', icon: '🚐' },
      { id: 'vanlife-hund', label: 'Vanlife Hund', icon: '🏕️' },
      { id: 'reise-hund', label: 'Reisehund', icon: '🗺️' },
      { id: 'abenteuer', label: 'Abenteuer', icon: '⛰️' },
      { id: 'tierfreundlich', label: 'Tierfreundlich', icon: '🏨' }
    ]
  },
  {
    name: 'Trip-Typen',
    description: 'Verschiedene Arten von Reisen und Aktivitäten',
    tags: [
      { id: 'spaziergang', label: 'Spaziergang', icon: '🚶' },
      { id: 'radfahren', label: 'Radfahren', icon: '🚴' },
      { id: 'roadtrip', label: 'Roadtrip', icon: '🚗' },
      { id: 'boot', label: 'Boot', icon: '⛵' },
      { id: 'flug', label: 'Flug', icon: '✈️' },
      { id: 'wandern', label: 'Wandern', icon: '🥾' },
    ]
  }
];

export const ALL_TAGS = TAG_GROUPS.flatMap(group => group.tags);

// Trip Types for TripPublishForm
export const TRIP_TYPES = [
  { id: 'spaziergang', label: 'Spaziergang', icon: '🚶' },
  { id: 'radfahren', label: 'Radfahren', icon: '🚴' },
  { id: 'roadtrip', label: 'Roadtrip', icon: '🚗' },
  { id: 'boot', label: 'Boot', icon: '⛵' },
  { id: 'flug', label: 'Flug', icon: '✈️' },
  { id: 'wandern', label: 'Wandern', icon: '🥾' },
  // Kein Fahrzeug, keine Bewegung – Signal an die KI: nur DIESEN Ort/Strand
  // beschreiben, keine Weiterfahrt, keine Ankunfts-/Abreise-Dramaturgie.
  { id: 'strand', label: 'Strand', icon: '🏖️' },
  { id: 'ort', label: 'Ort (nur diesen Ort beschreiben)', icon: '📍' },
] as const;

export type TripType = typeof TRIP_TYPES[number]['id'];

export default TAG_GROUPS;