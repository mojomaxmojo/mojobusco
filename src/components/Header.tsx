import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { OfflineBanner } from '@/components/ServiceWorkerStatus';
import {
  Menu, X, Home, FileText, Info, MapPin, Map, Camera, Images, StickyNote,
  ChevronDown, Flag, Wrench, Dog, Sun, Route, PenSquare, User, Settings,
  LogOut, Wallet, Pin,
} from '@/lib/icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MAIN_MENU_CONFIG, ACCOUNT_MENU_ITEMS, resolveSource } from '@/config/mainMenu';
import type { MainMenuItem } from '@/config/mainMenu';

// ── Icon Lookup ────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<any>> = {
  Home, FileText, Info, MapPin, Map, Camera, Images, StickyNote,
  Flag, Wrench, Dog, Sun, Route, PenSquare, User, Settings, Wallet, Pin,
};

function MenuIcon({ icon, emoji, className }: { icon?: string; emoji?: string; className?: string }) {
  if (emoji) return <span className={className || 'text-lg'}>{emoji}</span>;
  if (icon) {
    const Icon = iconMap[icon];
    if (Icon) return <Icon className={className || 'h-4 w-4'} />;
  }
  return null;
}

// ── Hilfsfunktion: Flat-Liste der Sub-Items (inkl. dynamischer Quellen) ────

function getChildItems(item: MainMenuItem): MainMenuItem[] {
  if (item.source) return resolveSource(item.source, item.pathPrefix || '/');
  return item.children || [];
}

function hasChildren(item: MainMenuItem): boolean {
  if (item.source) return true;
  return !!item.children && item.children.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function Header() {
  const { user } = useCurrentUser();
  const { logout } = useLoginActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<Set<string>>(new Set());

  const handleMobileMenuClick = useCallback(() => {
    setMobileMenuOpen(false);
    setMobileExpanded(new Set());
    document.body.style.overflow = '';
  }, []);

  const toggleMobileSection = useCallback((label: string) => {
    setMobileExpanded(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }, []);

  // ── Desktop Sub-Menü rekursiv rendern ─────────────────────────────────

  const renderDesktopSubItems = (items: MainMenuItem[]) => {
    return items.map((sub, i) => {
      if (sub.divider) return <DropdownMenuSeparator key={`div-${i}`} />;
      const children = getChildItems(sub);
      if (children.length > 0) {
        return (
          <DropdownMenuSub key={sub.label}>
            <DropdownMenuSubTrigger className="flex items-center gap-2">
              <MenuIcon icon={sub.icon} emoji={sub.emoji} />
              {sub.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {children.map((child, j) => (
                child.divider
                  ? <DropdownMenuSeparator key={`sdiv-${j}`} />
                  : (
                    <DropdownMenuItem key={child.label + (child.path || '')} asChild>
                      <Link to={child.path!} className="flex items-center gap-2">
                        <MenuIcon icon={child.icon} emoji={child.emoji} />
                        {child.label}
                      </Link>
                    </DropdownMenuItem>
                  )
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      }
      return (
        <DropdownMenuItem key={sub.label} asChild>
          <Link to={sub.path!} className="flex items-center gap-2">
            <MenuIcon icon={sub.icon} emoji={sub.emoji} />
            {sub.label}
          </Link>
        </DropdownMenuItem>
      );
    });
  };

  // ── Mobile Sub-Items (collapsible) ────────────────────────────────────

  const renderMobileSubItems = (items: MainMenuItem[], level: number = 0) => {
    return items.map((sub, i) => {
      if (sub.divider) return <div key={`mdiv-${i}`} className="border-t my-1 mx-2" />;
      const children = getChildItems(sub);
      const isExpanded = mobileExpanded.has(sub.label);

      if (children.length > 0 || sub.source) {
        return (
          <div key={sub.label} className="space-y-0" style={{ marginLeft: level * 12 }}>
            <button
              onClick={() => toggleMobileSection(sub.label)}
              className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg w-full text-left"
            >
              <MenuIcon icon={sub.icon} emoji={sub.emoji} className="h-4 w-4 shrink-0" />
              <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">{sub.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
              <div className="ml-6 mt-0.5 space-y-0.5">
                {renderMobileSubItems(children, level + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <Link
          key={sub.label + (sub.path || '')}
          to={sub.path!}
          onClick={handleMobileMenuClick}
          className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
          style={{ marginLeft: level * 12 }}
        >
          <MenuIcon icon={sub.icon} emoji={sub.emoji} className="h-4 w-4 shrink-0" />
          <span className="text-sm text-gray-900 dark:text-gray-100">{sub.label}</span>
        </Link>
      );
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

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

          {/* ═══════ DESKTOP NAVIGATION ═══════ */}
          <nav className="hidden md:flex items-center gap-px flex-1 justify-end">
            {MAIN_MENU_CONFIG.map((item) => {
              if (hasChildren(item)) {
                const children = getChildItems(item);
                return (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md">
                        <MenuIcon icon={item.icon} emoji={item.emoji} />
                        {item.label}
                        <ChevronDown className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 shadow-xl border-primary/20">
                      {renderDesktopSubItems(children)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              return (
                <Link
                  key={item.label}
                  to={item.path!}
                  className="flex items-center gap-2 text-foreground hover:text-primary px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:shadow-md"
                >
                  <MenuIcon icon={item.icon} emoji={item.emoji} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ═══════ DESKTOP USER ═══════ */}
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
                  {ACCOUNT_MENU_ITEMS.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link to={item.path!} className="flex items-center gap-2">
                        <MenuIcon icon={item.icon} emoji={item.emoji} />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
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

          {/* ═══════ MOBILE TOGGLE ═══════ */}
          <div className="md:hidden ml-auto">
            <button
              className="p-2"
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                document.body.style.overflow = mobileMenuOpen ? '' : 'hidden';
              }}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
      </header>

      {/* ═══════ MOBILE MENU ═══════ */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleMobileMenuClick} />
          <div
            className="fixed inset-y-0 right-0 z-[100] w-80 max-w-[90%] h-full overflow-y-auto shadow-2xl bg-background dark:bg-background border-l border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-primary/20">
              <h3 className="text-xl font-bold text-foreground">Menü</h3>
              <Button variant="ghost" size="icon" onClick={handleMobileMenuClick} className="hover:bg-primary/10 rounded-xl">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-2">
              {/* Mobile Navigation aus Config */}
              {MAIN_MENU_CONFIG.map((item) => {
                const children = getChildItems(item);
                const isExpanded = mobileExpanded.has(item.label);

                if (children.length > 0) {
                  return (
                    <Collapsible
                      key={item.label}
                      open={isExpanded}
                      onOpenChange={() => toggleMobileSection(item.label)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg w-full text-left">
                          <MenuIcon icon={item.icon} emoji={item.emoji} className="h-5 w-5 shrink-0" />
                          <span className="text-gray-900 dark:text-gray-100 flex-1">{item.label}</span>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="ml-6 space-y-1 mt-1">
                        {renderMobileSubItems(children)}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.path!}
                    onClick={handleMobileMenuClick}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <MenuIcon icon={item.icon} emoji={item.emoji} className="h-5 w-5 shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100">{item.label}</span>
                  </Link>
                );
              })}

              {/* Mobile Login / Account */}
              <div className="border-t pt-4 mt-4 space-y-2">
                {user ? (
                  <>
                    {ACCOUNT_MENU_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        to={item.path!}
                        onClick={handleMobileMenuClick}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                      >
                        <MenuIcon icon={item.icon} emoji={item.emoji} className="h-5 w-5 shrink-0" />
                        <span className="text-gray-900 dark:text-gray-100">{item.label}</span>
                      </Link>
                    ))}
                    <button
                      onClick={() => { logout(); handleMobileMenuClick(); }}
                      className="flex items-center gap-3 p-3 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg w-full text-left"
                    >
                      <LogOut className="h-5 w-5 text-red-600" />
                      <span className="text-red-600">Ausloggen</span>
                    </button>
                  </>
                ) : (
                  <LoginArea className="w-full" />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
