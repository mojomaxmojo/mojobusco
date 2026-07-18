/**
 * duration.ts — Hook-Dauer pro Plattform + calculateDuration
 *
 * EINZIGE QUELLE für die Hook-Dauer – wird von calculateDuration UND der
 * Komponente verwendet. NIEMALS an anderer Stelle hartcodieren!
 *
 * Realität der Hook-Fenster (siehe src/config/prompts/tiktok.js):
 *   TikTok:  0,8–1,2s Entscheidung → 3s Hook-Slide reicht
 *   Reels:   1,0–1,8s → 4s
 *   YouTube: 2,0–4,0s → 5s
 */

export const HOOK_SECONDS: Record<string, number> = {
  tiktok: 3,
  reels: 4,
  youtube: 5,
};

export function getHookSeconds(platform?: string): number {
  return HOOK_SECONDS[platform || 'tiktok'] ?? HOOK_SECONDS.tiktok;
}

import { groupImagesIntoSlides } from './slideLayouts';
import type { SlideLayout } from './videoProps';

export function calculateDuration(
  imageCount: number,
  fps: number,
  secondsPerImage: number,
  perSlideArray?: number[],
  showRouteMap?: boolean,
  platform?: string,
  slideLayouts?: SlideLayout[]
): { totalFrames: number; hookFrames: number; ctaFrames: number; slideshowFrames: number } {
  const hookFrames      = getHookSeconds(platform) * fps;
  const ctaFrames       = 6 * fps;

  // Layout-aware Slides: groupImagesIntoSlides braucht Dummy-URLs, wir nutzen
  // einfach leere Strings – zählt nur die Anzahl und Layouts.
  const imageUrls = Array.from({ length: imageCount }, () => '');
  const groups = groupImagesIntoSlides(imageUrls, slideLayouts ?? []);
  const baseSlideCount = groups.length;
  const totalSlideCount = showRouteMap && imageCount >= 2 ? baseSlideCount + 1 : baseSlideCount;

  const slideshowFrames = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray.reduce((sum, sec) => sum + Math.round(sec * fps), 0)
    : totalSlideCount * Math.round(secondsPerImage * fps);
  const totalFrames     = hookFrames + slideshowFrames + ctaFrames;
  return { totalFrames, hookFrames, ctaFrames, slideshowFrames };
}
