// Central type definitions for all configuration files

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: MenuItem[];
  badge?: string;
  isActive?: boolean;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  keywords: string[];
  cities: string[];
  regions?: { [key: string]: string[] };
  coordinates?: {
    bounds: { north: number; south: number; east: number; west: number; };
    center: { lat: number; lng: number; };
  };
  routes: {
    articles: string;
    places: string;
    images: string;
    notes: string;
  };
}

export interface DIYCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  emoji: string;
  path: string;
  tags: {
    primary: string[];
    secondary: string[];
  };
  color: {
    light: string;
    dark: string;
    bg: string;
  };
  examples: string[];
}

export interface ArticleCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  emoji: string;
  isDIY?: boolean;
  isLeon?: boolean;
  isRVLife?: boolean;
  isStrandOrt?: boolean;
  tags: {
    primary: string[];
    optional: string[];
  };
  autoTags?: string[]; // Automatische Tags bei Auswahl dieser Kategorie
  priority: number;
}

export interface TagInfo {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface TagGroup {
  name: string;
  description: string;
  tags: TagInfo[];
}

export interface Route {
  path: string;
  component: string;
  title: string;
  description?: string;
  requiresAuth?: boolean;
  category?: string;
}

export interface ContentCategory {
  id: string;
  name: string;
  route: string;
  kind: number;
  tags: {
    required: string[];
    optional?: string[];
    filter?: string[];
  };
  metadata?: {
    title?: string;
    description?: string;
    icon?: string;
    color?: string;
  };
}

export interface MediaTypeInfo {
  type: string;
  label: string;
  icon: any; // Lucide React icon component
  extensions: string[];
  accept: string;
}

export interface PlaceCategory {
  value: string;
  label: string;
  icon: string;
}

export interface FacilityOption {
  id: string;
  label: string;
  icon?: string;
}

export interface BestForOption {
  id: string;
  label: string;
  icon?: string;
}

export interface Author {
  id: string;
  name: string;
  npub: string;
  pubkey: string;
  nip05: string;
}

export interface RelayConfig {
  read?: {
    relayUrls: string[];
    maxRelays: number;
    queryTimeout: number;
  };
  write?: {
    relayUrls: string[];
    maxRelays: number;
    activeRelay?: string;
  };
  enableDeduplication?: boolean;
}

// Export type guards
export const isMenuItem = (item: any): item is MenuItem => {
  return item && typeof item === 'object' && 'id' in item && 'label' in item && 'icon' in item;
};

export const isCountry = (country: any): country is Country => {
  return country && typeof country === 'object' &&
         'code' in country && 'name' in country && 'flag' in country &&
         'keywords' in country && 'cities' in country && 'routes' in country;
};

export const isDIYCategory = (category: any): category is DIYCategory => {
  return category && typeof category === 'object' &&
         'id' in category && 'name' in category && 'description' in category &&
         'tags' in category && 'primary' in category.tags;
};

export const isArticleCategory = (category: any): category is ArticleCategory => {
  return category && typeof category === 'object' &&
         'id' in category && 'name' in category && 'description' in category &&
         'tags' in category && 'priority' in category;
};