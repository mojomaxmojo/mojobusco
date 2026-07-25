import { findHeroWordWindow } from './components/CaptionHeroWord';
import type { SlideDef } from './slidePlan';

export interface HeroWordWindow {
  slideIndex: number;
  startFrame: number;
  endFrame: number;
}

export function buildHeroWordWindows(
  slideDefs: SlideDef[],
  captions: string[],
  slideStartFrame: (idx: number) => number
): HeroWordWindow[] {
  // Hook-Wort-Zoom: Fenster des per **...** markierten Wortes pro Slide
  // Reine Berechnung (keine Wirkung ohne den erweiterten punchHere-Check
  // unten in der Slideshow-Schleife). Nur Bild-Slides mit vorhandener
  // Caption werden geprüft; Route-Slides und fehlende Captions liefern null.
  return slideDefs
    .map((def, i) => {
      if (def.type !== 'image') return null;
      const captionText = captions[i];
      if (!captionText) return null;
      const win = findHeroWordWindow(captionText, slideStartFrame(i), def.frames);
      return win ? { slideIndex: i, ...win } : null;
    })
    .filter((w): w is HeroWordWindow => w !== null);
}

export function buildPreviousImageUrls(
  slideDefs: SlideDef[],
  images: string[]
): (string | null)[] {
  // Einfaches vorheriges Bild pro Slide (nur für cardFlip-Transition)
  // Index 0 = Hook-Bild, danach das vorhergehende Bild (Route-Slides überspringen).
  return slideDefs.map((def, i) => {
    const firstImage = (d: SlideDef) => images[d.imageIndices[0]] || null;
    if (i === 0) {
      const firstImageSlide = slideDefs.find(d => d.type === 'image');
      return firstImageSlide ? firstImage(firstImageSlide) : null;
    }
    for (let j = i - 1; j >= 0; j--) {
      if (slideDefs[j].type === 'image') {
        return firstImage(slideDefs[j]);
      }
    }
    const firstImageSlide = slideDefs.find(d => d.type === 'image');
    return firstImageSlide ? firstImage(firstImageSlide) : null;
  });
}
