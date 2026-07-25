import type { SlideLayout } from './videoProps';
import { groupImagesIntoSlides, findRouteSlideIndex } from './slideLayouts';

export interface SlideDef {
  type: 'image' | 'route';
  imageIndices: number[];
  frames: number;
  layout?: SlideLayout;
}

export interface SlidePlan {
  baseGroups: { layout: SlideLayout; imageIndices: number[] }[];
  baseSlideCount: number;
  hasRouteMap: boolean;
  routeVisualIndex: number;
  totalSlideCount: number;
  slidesSec: number[];
  slidesFrames: number[];
  slideDefs: SlideDef[];
  totalSlides: number;
  slideshowFrames: number;
  slideStartFrame: (idx: number) => number;
  routeDurFrames: number;
}

export function buildSlidePlan(
  params: {
    imageUrls: string[];
    secondsPerImage: number;
    perSlideArray?: number[];
    showRouteMap: boolean;
    slideLayouts?: SlideLayout[];
    hookFrames: number;
  },
  fps: number
): SlidePlan {
  const { imageUrls, secondsPerImage, perSlideArray, showRouteMap, slideLayouts, hookFrames } = params;

  // Bilder werden anhand slideLayouts in Gruppen aufgeteilt. Der Routen-Slide
  // wird als EXTRA Slide eingefügt und ersetzt kein Bild.
  const baseGroups = groupImagesIntoSlides(imageUrls, slideLayouts ?? []);
  const baseSlideCount = baseGroups.length;

  const hasRouteMap = showRouteMap && imageUrls.length >= 2;
  const routeVisualIndex = hasRouteMap ? findRouteSlideIndex(baseGroups) : -1;
  const totalSlideCount = baseSlideCount + (hasRouteMap ? 1 : 0);

  // Dynamische perSlide: perSlideArray vom Server (inkl. RouteMap), sonst fix
  const slidesSec = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray
    : new Array(totalSlideCount).fill(secondsPerImage);
  const slidesFrames = slidesSec.map(s => Math.round(s * fps));

  // Route-Dauer aus slidesFrames (enthält bereits RouteMap an routeVisualIndex)
  const routeDurFrames = hasRouteMap
    ? (slidesFrames[routeVisualIndex] || Math.round(secondsPerImage * fps))
    : 0;

  // Slide-Definitionen: jeder Eintrag kann ein oder mehrere Bilder enthalten
  const slideDefs: SlideDef[] = [];
  let framesIdx = 0;
  baseGroups.forEach((group, groupIdx) => {
    if (hasRouteMap && groupIdx === routeVisualIndex) {
      slideDefs.push({ type: 'route', imageIndices: [], frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps) });
      framesIdx++;
    }
    slideDefs.push({
      type: 'image',
      imageIndices: group.imageIndices,
      frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps),
      layout: group.layout,
    });
    framesIdx++;
  });
  if (hasRouteMap && routeVisualIndex >= baseGroups.length) {
    slideDefs.push({ type: 'route', imageIndices: [], frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps) });
  }

  const totalSlides = slideDefs.length;
  const slideshowFrames = slideDefs.reduce((sum, s) => sum + s.frames, 0); // inkl. RouteMap

  const slideStartFrame = (idx: number) =>
    hookFrames + slideDefs.slice(0, idx).reduce((sum, s) => sum + s.frames, 0);

  return {
    baseGroups,
    baseSlideCount,
    hasRouteMap,
    routeVisualIndex,
    totalSlideCount,
    slidesSec,
    slidesFrames,
    slideDefs,
    totalSlides,
    slideshowFrames,
    slideStartFrame,
    routeDurFrames,
  };
}
