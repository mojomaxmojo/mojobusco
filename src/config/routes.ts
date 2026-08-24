import { Route } from '@/config/types';

export const ROUTES: Route[] = [
  { path: '/', component: 'Home', title: 'Home', description: 'MojoBus Perpetual Travelers Blog' },
  { path: '/artikel', component: 'Articles', title: 'Artikel', category: 'articles' },
  { path: '/artikel/:country', component: 'Articles', title: 'Artikel aus Land', category: 'articles' },
  { path: '/artikel/diy', component: 'DIY', title: 'DIY Anleitungen', category: 'diy' },
  { path: '/artikel/diy/:category', component: 'DIY', title: 'DIY Kategorie', category: 'diy' },
  { path: '/artikel/leon', component: 'Leon', title: 'Leon Stories', category: 'leon' },
  { path: '/artikel/leon/:category', component: 'Leon', title: 'Leon Kategorie', category: 'leon' },
  { path: '/artikel/rvlife', component: 'RVLife', title: 'RV Life', category: 'rvlife' },
  { path: '/artikel/rvlife/:category', component: 'RVLife', title: 'RV Life Kategorie', category: 'rvlife' },
  { path: '/artikel/strand-ort', component: 'StrandOrt', title: 'Strand/Ort', category: 'strandort' },
  { path: '/artikel/strand-ort/:category', component: 'StrandOrt', title: 'Strand/Ort Kategorie', category: 'strandort' },
  { path: '/plaetze', component: 'Places', title: 'Plätze', category: 'places' },
  { path: '/plaetze/:country', component: 'Places', title: 'Plätze in Land', category: 'places' },
  { path: '/bilder', component: 'Images', title: 'Bilder', category: 'media' },
  { path: '/bilder/:country', component: 'Images', title: 'Bilder aus Land', category: 'media' },
  { path: '/bilder/natur/:category', component: 'Images', title: 'Natur Bilder', category: 'media' },
  { path: '/notes', component: 'Notes', title: 'Notes', category: 'notes' },
  { path: '/notes/:country', component: 'Notes', title: 'Notes aus Land', category: 'notes' },
  { path: '/artikel/notes', component: 'Notes', title: 'Notes', category: 'notes' },
  { path: '/artikel/notes/:country', component: 'Notes', title: 'Notes aus Land', category: 'notes' },
  { path: '/videos', component: 'Videos', title: 'Videos', category: 'videos' },
  { path: '/video/:naddr', component: 'VideoDetail', title: 'Video', category: 'videos' },
  { path: '/about', component: 'About', title: 'About' },
  { path: '/admin/about', component: 'AboutAdmin', title: 'About verwalten', requiresAuth: true },
  { path: '/profile', component: 'Profile', title: 'Profil', requiresAuth: true },
  { path: '/settings', component: 'Settings', title: 'Einstellungen', requiresAuth: true },
  { path: '/veroeffentlichen', component: 'Publish', title: 'Veröffentlichen', requiresAuth: true },
  { path: '/budget', component: 'BudgetPage', title: 'Haushaltsbuch', requiresAuth: true },
  { path: '/:nip19', component: 'NIP19Page', title: 'Nostr Content' },
  { path: '*', component: 'NotFound', title: 'Seite nicht gefunden' }
];

export default ROUTES;