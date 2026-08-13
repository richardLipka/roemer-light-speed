/**
 * Zoom with the wheel, over the thing being zoomed.
 *
 * A slider in the left dock is a fine way to *set* a magnification and a poor
 * way to *find* one: the eye is on the instrument and the hand is somewhere
 * else, so every adjustment is a round trip. Over the drawing itself the loop
 * closes, and the two fields keep their own zooms without anyone having to
 * remember which slider belongs to which panel — the wheel is over one of them.
 *
 * **Multiplicative, not additive.** A fixed step of 0.5 is a doubling at the
 * bottom of the range and a rounding error at the top; a fixed *ratio* feels the
 * same everywhere, which is the whole of what "natural" means here.
 */

export interface WheelZoomOptions {
  read: () => number;
  write: (value: number) => void;
  min: number;
  max: number;
}

/**
 * Per notch, roughly. Chosen so a comfortable flick of a trackpad crosses the
 * range in about a second without a single detent ever overshooting what the eye
 * was following.
 */
const SENSITIVITY = 0.0015;

export function wheelZoom(element: HTMLElement, options: WheelZoomOptions): void {
  element.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      // The page must not scroll out from under a zoom, and `passive: false` is
      // what earns the right to say so.
      event.preventDefault();

      // Firefox reports lines and, rarely, pages; Chrome reports pixels. Left
      // unnormalised, one notch is a nudge in one browser and a leap in another.
      const pixels =
        event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;

      const next = options.read() * Math.exp(-pixels * SENSITIVITY);
      options.write(Math.min(options.max, Math.max(options.min, next)));
    },
    { passive: false },
  );
}
