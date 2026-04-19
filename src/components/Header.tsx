import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { OfflineBanner } from '@/components/ServiceWorkerStatus';
import {
  Menu,
  X,
  PenSquare,
  User,
  Settings,
  LogOut,
  MapPin,
  Map,
  Home,
  FileText,
  Info,
  Images,
  ChevronDown,
  Flag,
  Camera,
  StickyNote,
  Dog,
  Wrench,
  Mountain,
  Calendar,
  Lightbulb,
  Sun,
  Wallet,
  Pin,
} from '@/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { MAIN_MENU } from '@/config';

export function Header() {
  const { user, isLoading } = useCurrentUser();
  const { logout } = useLoginActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const editEventId = searchParams.get('edit');
  const editType = searchParams.get('type');
  const [activeTab, setActiveTab] = useState(editType || 'note');

  const handleMobileMenuClick = () => {
    setMobileMenuOpen(false);
    document.body.style.overflow = '';
  };

  // Icon mapping for Nature categories
  const getNatureIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'strand': return Camera; // temporarily use Camera
      case 'berge': return Mountain;
      case 'see': return Camera; // temporarily use Camera
      case 'wald': return Camera; // temporarily use Camera
      case 'wasserfall': return Camera; // temporarily use Camera
      case 'wiese': return Sun;
      case 'tiere': return Camera;
      default: return Camera;
    }
  };

  return (
    <>
      <OfflineBanner />
      <header className="sticky top-0 z-50 w-full border-b border-primary/20 glass-effect shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center">
          <Link to="/" className="inline-flex items-center hover:scale-105 transition-transform duration-300">
            <img
              src="/mojobuslogo.png"
              alt="MojoBus Logo"
              width="250"
              height="176"
              style={{ objectFit: 'contain', display: 'block', background: 'transparent' }}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-px flex-1 justify-end">
            {/* Home */}
            <Link
              to="/"
              className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>

            {/* Artikel mit Sub-Menü */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md">
                  <FileText className="h-4 w-4" />
                  Artikel
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 shadow-xl border-primary/20">
                <DropdownMenuItem asChild>
                  <Link to="/artikel" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Alle Artikel
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Nach Länder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {Object.values(MAIN_MENU.countries).map((country) => (
                      <DropdownMenuItem key={country.code} asChild>
                        <Link to={`/artikel/${country.code}`} className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          {country.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    🛠️ DIY
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {Object.values(MAIN_MENU.diy).map((category) => (
                      <DropdownMenuItem key={category.id} asChild>
                        <Link to={`/artikel/diy/${category.id}`} className="flex items-center gap-2">
                          <span>{category.emoji}</span>
                          {category.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    🚐 RV Life
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to="/artikel/rvlife/kueche-essen" className="flex items-center gap-2">
                        <span>🍳</span>
                        Küche & Essen
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/artikel/rvlife/ausstattung" className="flex items-center gap-2">
                        <span>🏠</span>
                        Ausstattung
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/artikel/rvlife/freeliving" className="flex items-center gap-2">
                        <span>🕊️</span>
                        Freeliving
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/artikel/rvlife/lifestyle" className="flex items-center gap-2">
                        <span>✨</span>
                        Lifestyle
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/artikel/leon" className="flex items-center gap-2">
                    <Dog className="h-4 w-4" />
                    <span>🦁</span>
                    Leon Story
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Plätze */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md">
                  <MapPin className="h-4 w-4" />
                  Plätze
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 shadow-xl border-primary/20">
                <DropdownMenuItem asChild>
                  <Link to="/plaetze" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Alle Plätze
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Nach Länder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {Object.values(MAIN_MENU.countries).map((country) => (
                      <DropdownMenuItem key={country.code} asChild>
                        <Link to={`/plaetze/${country.code}`} className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          {country.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Nach Typen
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to="/plaetze/campingplatz" className="flex items-center gap-2">
                        <span className="text-lg">🏕️</span>
                        <span className="text-gray-900 dark:text-gray-100">Campingplatz</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/plaetze/wildcamping" className="flex items-center gap-2">
                        <span className="text-lg">🌲</span>
                        <span className="text-gray-900 dark:text-gray-100">Wildcamping</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/plaetze/stellplatz" className="flex items-center gap-2">
                        <span className="text-lg">🅿️</span>
                        <span className="text-gray-900 dark:text-gray-100">Stellplatz</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/plaetze/aussichtspunkt" className="flex items-center gap-2">
                        <span className="text-lg">👁️</span>
                        <span className="text-gray-900 dark:text-gray-100">Aussichtspunkt</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/plaetze/strand" className="flex items-center gap-2">
                        <span className="text-lg">🏖️</span>
                        <span className="text-gray-900 dark:text-gray-100">Strand</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

              {/* Map mit Sub-Menü */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md">
                   <Map className="h-4 w-4" />
                   Map
                   <ChevronDown className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-56 shadow-xl border-primary/20">
                 <DropdownMenuItem asChild>
                   <Link to="/map" className="flex items-center gap-2">
                     <Map className="h-4 w-4" />
                     Alle Karten
                   </Link>
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                   <Link to="/map/trips" className="flex items-center gap-2">
                     <span className="text-lg">🛣️</span>
                     Trips
                   </Link>
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>

            {/* Bilder */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-foreground hover:text-accent px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:bg-accent/10 hover:shadow-md">
                  <Camera className="h-4 w-4" />
                  Bilder
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 shadow-xl border-accent/20">
                <DropdownMenuItem asChild>
                  <Link to="/bilder" className="flex items-center gap-2">
                    <Images className="h-4 w-4" />
                    Alle Bilder
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Nach Länder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {Object.values(MAIN_MENU.countries).map((country) => (
                      <DropdownMenuItem key={country.code} asChild>
                        <Link to={`/bilder/${country.code}`} className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          {country.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Natur
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {Object.values(MAIN_MENU.nature).map((category) => (
                      <DropdownMenuItem key={category.id} asChild>
                        <Link to={`/bilder/natur/${category.id}`} className="flex items-center gap-2">
                          <span>{category.emoji}</span>
                          {category.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notes */}
            <Link
              to="/notes"
              className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md"
            >
              <StickyNote className="h-4 w-4" />
              Notes
            </Link>

            {/* About */}
            <Link
              to="/about"
              className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md"
            >
              <Info className="h-4 w-4" />
              About
            </Link>
          </nav>

          {/* User Actions - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="default" className="hover:bg-primary/10 transition-all duration-300 rounded-xl">
                    <User className="h-4 w-4 mr-2" />
                    Account
                    <ChevronDown className="h-3 w-3 ml-2 transition-transform duration-200" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="shadow-xl border-primary/20">
                  <DropdownMenuItem asChild>
                    <Link to="/veroeffentlichen" className="flex items-center gap-2">
                      <PenSquare className="h-4 w-4" />
                      Beitrag erstellen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Einstellungen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/budget" className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Haushaltsbuch
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/promotion" className="flex items-center gap-2">
                      <Pin className="h-4 w-4" />
                      Pinterest Promotion
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-red-600">
                    <LogOut className="h-4 w-4" />
                    Ausloggen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LoginArea />
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              className="p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

    </header>

    {/* Mobile Menu - Outside header to prevent overflow */}
    {mobileMenuOpen && (
      <>
        {/* Overlay */}
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={handleMobileMenuClick}
        />
        {/* Menu Content */}
        <div
          className="fixed inset-y-0 right-0 z-[100] w-80 max-w-[90%] h-full overflow-y-auto shadow-2xl bg-background dark:bg-background border-l border-border"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between p-6 border-b border-primary/20">
              <h3 className="text-xl font-bold text-foreground">Menü</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:bg-primary/10 rounded-xl"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-3">
              {/* Mobile Home */}
              <Link
                to="/artikel"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                onClick={handleMobileMenuClick}
              >
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900 dark:text-gray-100">Alle Artikel</span>
              </Link>

              {/* Mobile Artikel */}
              <div className="space-y-1">
                <Link
                  to="/artikel"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={handleMobileMenuClick}
                >
                  <FileText className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-900 dark:text-gray-100">Alle Artikel</span>
                </Link>
                <Link
                  to="/artikel/leon"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={handleMobileMenuClick}
                >
                  <Dog className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-900 dark:text-gray-100">Leon Story</span>
                </Link>
              </div>

              <div className="space-y-1">
                <Link
                  to="/plaetze"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={handleMobileMenuClick}
                >
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-900 dark:text-gray-100">Alle Plätze</span>
                </Link>
              </div>

              {/* Mobile Map */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                  Map
                </div>
                <Link
                  to="/map"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={handleMobileMenuClick}
                >
                  <Map className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-900 dark:text-gray-100">Alle Karten</span>
                </Link>
                <Link
                  to="/map/trips"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  onClick={handleMobileMenuClick}
                >
                  <span className="text-lg">🛣️</span>
                  <span className="text-gray-900 dark:text-gray-100">Trips</span>
                </Link>
              </div>

              {/* Mobile Bilder */}
              <div className="space-y-1">
                <Link
                  to="/bilder"
                  className="flex items-center gap-3 p-3 hover:bg-[#ec1a58]/5 rounded-lg transition-colors"
                  onClick={handleMobileMenuClick}
                >
                  <Camera className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-900 dark:text-gray-100">Alle Bilder</span>
                </Link>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                  Nach Länder
                </div>
                <div className="space-y-2">
                  {Object.values(MAIN_MENU.countries).map((country) => (
                    <Link
                      key={country.code}
                      to={`/bilder/${country.code}`}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                      onClick={handleMobileMenuClick}
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="text-gray-900 dark:text-gray-100">{country.name}</span>
                    </Link>
                  ))}
                </div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                  Natur
                </div>
                <div className="space-y-2">
                  {Object.values(MAIN_MENU.nature).map((category) => (
                    <Link
                      key={category.id}
                      to={`/bilder/natur/${category.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                      onClick={handleMobileMenuClick}
                    >
                      <span>{category.emoji}</span>
                      <span className="text-gray-900 dark:text-gray-100">{category.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Mobile Notes */}
              <Link
                to="/notes"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                onClick={handleMobileMenuClick}
              >
                <StickyNote className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900 dark:text-gray-100">Alle Notes</span>
              </Link>

              {/* Mobile About */}
              <Link
                to="/about"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                onClick={handleMobileMenuClick}
              >
                <Info className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900 dark:text-gray-100">About</span>
              </Link>

              {/* Mobile User Actions */}
              {user ? (
                <div className="border-t dark:border-gray-700 pt-4 mt-4 space-y-2">
                  <Link
                    to="/veroeffentlichen"
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    onClick={handleMobileMenuClick}
                  >
                    <PenSquare className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-900 dark:text-gray-100">Beitrag erstellen</span>
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    onClick={handleMobileMenuClick}
                  >
                    <User className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-900 dark:text-gray-100">Profil</span>
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    onClick={handleMobileMenuClick}
                  >
                    <Settings className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-900 dark:text-gray-100">Einstellungen</span>
                  </Link>
                  <Link
                    to="/budget"
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    onClick={handleMobileMenuClick}
                  >
                    <Wallet className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-900 dark:text-gray-100">Haushaltsbuch</span>
                  </Link>
                  <Link
                    to="/promotion"
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    onClick={handleMobileMenuClick}
                  >
                    <Pin className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-900 dark:text-gray-100">Pinterest Promotion</span>
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      handleMobileMenuClick();
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg w-full text-left"
                  >
                    <LogOut className="h-5 w-5 text-red-600" />
                    <span className="text-red-600">Ausloggen</span>
                  </button>
                </div>
              ) : (
                <div className="border-t dark:border-gray-700 pt-4 mt-4">
                  <LoginArea />
                </div>
              )}
            </div>
        </div>
      </>
    )}
    </>
  );
}
