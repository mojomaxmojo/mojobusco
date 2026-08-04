import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * CardSkeleton – CLS-sicherer Skeleton für ContentCard.
 *
 * Nutzt die echten CardHeader/CardContent-Komponenten, damit Padding/Gaps exakt
 * mit der echten Card übereinstimmen. Die inneren Placeholder haben Mindest-
 * Höhen, die dem Maximal-Höhen-Szenario der echten Card entsprechen:
 *   - Title: line-clamp-2 text-xl → 2 × 28px = 56px (h-14)
 *   - Summary: line-clamp-3 text-sm mt-2 → 60px + 8px = 68px
 *   - SocialBar: py-2 + h-8 + border-t → 49px
 * Damit reduziert sich die Verschiebung beim Skeleton → Echt-Übergang auf ein
 * Minimum (Content-Längen variieren, das lässt sich nicht ganz vermeiden).
 */
export function CardSkeleton() {
  return (
    <Card className="group overflow-hidden border-2 border-primary/20 rounded-2xl flex flex-col">
      <div className="flex flex-col h-full">
        {/* Bild-/Video-Bereich: gleiches Aspect-Ratio wie ContentCard */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <div className="absolute inset-0 bg-muted animate-pulse" />
        </div>

        {/* CardHeader mit echter Struktur */}
        <CardHeader className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            {/* Icon-Platz (z.B. MapPin bei Orten) */}
            <div className="h-5 w-5 bg-muted animate-pulse rounded-sm flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-4">
              {/* Title placeholder: line-clamp-2 text-xl → max. 56px */}
              <div className="h-14 bg-muted animate-pulse rounded-md w-3/4" />
              {/* Summary placeholder: line-clamp-3 text-sm mt-2 → 60px + 8px */}
              <div className="h-[60px] bg-muted animate-pulse rounded-md w-full mt-2" />
            </div>
          </div>
        </CardHeader>

        {/* CardContent mit echter Struktur */}
        <CardContent className="flex-1 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
              <span className="text-muted-foreground/50">•</span>
              <div className="h-4 w-20 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </CardContent>
      </div>

      {/* SocialBar-Bereich */}
      <div className="px-6 pb-6 pt-0">
        <div className="h-8 bg-muted animate-pulse rounded-lg w-full py-2" />
      </div>
    </Card>
  );
}
