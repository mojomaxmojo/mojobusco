/**
 * NoteTagsSection.tsx — Tags-Bereich (vorgeschlagene Badges, eigene Tags,
 * Ausgewaehlte Tags) des Note-Formulars — 1:1 aus NoteForm.tsx verschoben
 * (PLAN5.md Schritt 3). Reines Verschieben, keine Logik-Änderungen.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getOptionalTags } from '@/config/contentCategories';
import type { Dispatch, SetStateAction } from "react";

interface NoteTagsSectionProps {
  tags: string[];
  setTags: Dispatch<SetStateAction<string[]>>;
}

export function NoteTagsSection({ tags, setTags }: NoteTagsSectionProps) {
  const handleTagToggle = (tag: string) => {
    setTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <>
      <div className="space-y-3">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {getOptionalTags('notes').map(tag => (
            <Badge
              key={tag}
              variant={tags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Eigene Tags (mit Leerzeichen trennen)..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = e.currentTarget.value;
                const newTags = value.split(' ').filter(Boolean);
                setTags(prev => [...prev, ...newTags]);
                e.currentTarget.value = '';
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              const value = input.value;
              const newTags = value.split(' ').filter(Boolean);
              setTags(prev => [...prev, ...newTags]);
              input.value = '';
            }}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="space-y-2">
          <Label>Ausgewaehlte Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="gap-1"
              >
                {tag}
                <button
                  className="ml-1 text-xs hover:text-red-500"
                  onClick={() => setTags(prev => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
