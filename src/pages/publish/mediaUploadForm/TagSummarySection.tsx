/**
 * TagSummarySection.tsx
 *
 * Tag-Zusammenfassung (reine Anzeige) — 1:1 aus MediaUploadForm.tsx
 * verschoben (PLAN3.md Schritt 2, ehem. Z. 1590–1643).
 * Reines Verschieben, keine Logik-Änderungen.
 */

import { Badge } from "@/components/ui/badge";
import { mainCategories } from "../publishUtils";

export function TagSummarySection({ mainCategory, selectedSubTags, detailedTags, customTags }: {
  mainCategory: string;
  selectedSubTags: string[];
  detailedTags: string[];
  customTags: string;
}) {
  return (
    <>
      {/* Tag Summary */}
      {(mainCategory || selectedSubTags.length > 0 || detailedTags.length > 0 || customTags) && (
            <div className="mt-6 p-4 bg-ocean-50 dark:bg-ocean-950 rounded-lg border border-ocean-200 dark:border-ocean-800">
              <h4 className="font-medium text-ocean-900 dark:text-ocean-100 mb-3">
                📋 Zusammenfassung aller Tags
              </h4>
              <div className="space-y-2">
                {mainCategory && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Hauptkategorie:</span>
                    <Badge className="ml-2 bg-ocean-600 text-white">
                      {mainCategories.find(cat => cat.value === mainCategory)?.icon} {mainCategory}
                    </Badge>
                  </div>
                )}
                {selectedSubTags.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Themen:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSubTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="bg-ocean-100 text-ocean-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {detailedTags.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Detail-Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailedTags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs border-green-300 text-green-700">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {customTags && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Eigene Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {customTags.split(' ').filter(Boolean).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-purple-300 text-purple-700">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
    </>
  );
}
