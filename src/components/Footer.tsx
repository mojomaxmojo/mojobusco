import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t, localizePath } = useLanguage();

  return (
    <footer className="border-t border-primary/20 bg-gradient-to-b from-background to-primary/5 min-h-[200px] contain-layout">
      <div className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          {/* Brand */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <img
                src="/icon-96x96.png"
                alt="MojoBus Logo"
                width="50"
                height="50"
                className="h-14 w-14 object-contain hover:scale-110 transition-transform duration-300"
              />
              <span className="font-bold text-2xl gradient-text">MojoBus</span>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              {t('footer_tagline')}
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 font-medium hover:bg-primary/20 transition-colors cursor-default">#offgridlife</span>
              <span className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 font-medium hover:bg-primary/20 transition-colors cursor-default">#beachlife</span>
              <span className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 font-medium hover:bg-primary/20 transition-colors cursor-default">#vanlife</span>
              <span className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 font-medium hover:bg-primary/20 transition-colors cursor-default">#rvlife</span>
              <span className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 font-medium hover:bg-primary/20 transition-colors cursor-default">#oceanview</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-8">
            <h3 className="font-bold text-xl">{t('footer_nav_heading')}</h3>
            <nav className="flex flex-col space-y-4">
              <Link to={localizePath('/')} className="text-base text-muted-foreground hover:text-primary transition-all duration-300 hover:translate-x-1">
                {t('nav_home')}
              </Link>
              <Link to={localizePath('/artikel')} className="text-base text-muted-foreground hover:text-primary transition-all duration-300 hover:translate-x-1">
                {t('nav_articles')}
              </Link>
              <Link to={localizePath('/notes')} className="text-base text-muted-foreground hover:text-primary transition-all duration-300 hover:translate-x-1">
                {t('nav_notes')}
              </Link>
              <Link to={localizePath('/about')} className="text-base text-muted-foreground hover:text-primary transition-all duration-300 hover:translate-x-1">
                {t('nav_about')}
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-8">
            <h3 className="font-bold text-xl">{t('footer_contact_heading')}</h3>
            <div className="text-sm text-muted-foreground space-y-4">
              <p className="flex items-center gap-3 text-base">
                <span className="text-primary text-xl">⚡</span>
                <span>Lightning: wiseboot30@zeusnuts.com</span>
              </p>
              <p className="flex items-center gap-3 text-base">
                <span className="text-primary text-xl">🔑</span>
                <span>NIP-05: mojo@mojobus.co</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-primary/20 text-center text-sm text-muted-foreground">
          <p>{t('footer_copyright', { year: String(currentYear) })}</p>
        </div>
      </div>
    </footer>
  );
}
