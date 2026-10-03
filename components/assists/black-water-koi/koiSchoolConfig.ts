/** Diffuse maps (same UVs as `koi_fish_ow.glb`) — swap or add entries for your bundle. */
export const KOI_DIFFUSE = {
  ow: '/koi-diffuse-ow.png',
  gray: '/koi-diffuse-gray.png',
  charcoal: '/koi-diffuse-charcoal.png',
} as const;

export type KoiSwimmerSpec = {
  id: string;
  /** Path under /public */
  diffuse: string;
  /** Initial XZ in the pond */
  spawn: [number, number];
  /**
   * Depth below the water surface (world Y), typically **0.4–0.9** — not 20/40/80.
   * Small differences layer fish vertically; overlap on screen is mostly **XZ** (use spawn + avoidance).
   */
  swimDepth?: number;
  /** World body length multiplier (default uses shared target length). */
  lengthScale?: number;
  speedScale?: number;
  /** 0–1 offset into the swim cycle so fish desync. */
  animPhase?: number;
};

/** Default pond population (3 fish). Duplicate a spec to reach 4. */
export const KOI_SCHOOL: KoiSwimmerSpec[] = [
  {
    id: 'ow',
    diffuse: KOI_DIFFUSE.ow,
    spawn: [-3.2, -2.8],
    swimDepth: 0.60,
    speedScale: 1,
    animPhase: 0,
  },
  {
    id: 'gray',
    diffuse: KOI_DIFFUSE.gray,
    spawn: [3.4, -2.4],
    swimDepth: 0.30,
    lengthScale: 0.94,
    speedScale: 0.92,
    animPhase: 0.38,
  },
  {
    id: 'charcoal',
    diffuse: KOI_DIFFUSE.charcoal,
    spawn: [-2.6, 3.15],
    swimDepth: 0.90,
    lengthScale: 1.06,
    speedScale: 0.88,
    animPhase: 0.72,
  },
];
