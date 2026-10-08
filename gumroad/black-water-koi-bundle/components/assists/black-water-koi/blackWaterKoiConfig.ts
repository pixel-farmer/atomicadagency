/**
 * Black Water Koi — buyer settings. Edit before deploy.
 */
export const BLACK_WATER_KOI_CONFIG = {
  /**
   * Rain audio + mic toggle (lower-right), looping `/raining.ogg`.
   * Set `false` to remove audio entirely: no mic button is rendered and the audio file is
   * never requested, so `public/raining.ogg` can be deleted.
   */
  soundButtonEnabled: true,
  /** Small trailing ripples under the cursor (or a dragging finger). Set `false` to disable. */
  cursorRipplesEnabled: true,
} as const;
