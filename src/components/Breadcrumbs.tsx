/**
 * Breadcrumbs – Sichtbare Breadcrumb-Navigation für SEO + UX
 *
 * Stellt den Navigationspfad dar, sowohl visuell für Nutzer als auch
 * als JSON-LD Structured Data für Google Rich Results.
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Artikel', href: '/artikel' },
 *     { label: 'Artikel-Titel', href: '/naddr1...' },
 *   ]} />
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="hover:text-primary transition-colors duration-200 truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'text-foreground font-medium truncate max-w-[250px]' : 'truncate max-w-[200px]'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}