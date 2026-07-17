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

export function calculateDuration(
  imageCount: number,
  fps: number,
  secondsPerImage: number,
  perSlideArray?: number[],
  showRouteMap?: boolean,
  platform?: string
): { totalFrames: number; hookFrames: number; ctaFrames: number; slideshowFrames: number } {
  const hookFrames      = getHookSeconds(platform) * fps;  // plattformabhängig: TikTok 3s, Reels 4s, YouTube 5s
  const ctaFrames       = 6 * fps;
  const totalSlideCount = showRouteMap && imageCount >= 2 ? imageCount + 1 : imageCount;
  // Wenn perSlideArray übergeben: dynamische Summe, sonst fix
  const slideshowFrames = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray.reduce((sum, sec) => sum + Math.round(sec * fps), 0)
    : totalSlideCount * Math.round(secondsPerImage * fps);
  const totalFrames     = hookFrames + slideshowFrames + ctaFrames;
  return { totalFrames, hookFrames, ctaFrames, slideshowFrames };
}
