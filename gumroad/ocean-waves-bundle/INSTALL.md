# Ocean Waves — Install guide

Full-viewport moody beach for Next.js + React Three Fiber: shader swells, sand texture, optional looped wave audio.

**Version:** packaged from Vaxion Studios assist  

**License:** read **LICENSE.md** in this zip before use. Single-seat license — **no reselling or redistributing** the source or assets.

---

## Requirements

- **Next.js** 13+ (App Router recommended) or compatible React 18+ setup
- **TypeScript** recommended (files are `.tsx`)
- Path alias `@/*` → project root (default in Next.js)

## 1. Install dependencies

```bash
npm install three @react-three/fiber @react-three/drei
```

Example versions:

```json
"three": "^0.170.0",
"@react-three/fiber": "^9.0.0",
"@react-three/drei": "^10.0.0"
```

Tailwind CSS is **optional** — class names are plain strings; swap for your own CSS if needed.

## 2. Copy files

| Bundle path | Your project |
|-------------|----------------|
| `components/assists/rolling-shore/` | `components/assists/rolling-shore/` |
| `components/canvas/` | `components/canvas/` |
| `public/sand03-seamless.png` | `public/sand03-seamless.png` |
| `public/ocean-waves.mp3` | `public/ocean-waves.mp3` |

Keep the `@/components/...` import paths — they match the layout above.

## 3. Run the example page

Copy `example/OceanWavesPage.tsx` to e.g. `app/ocean/page.tsx` and visit `/ocean`.

Or mount anywhere:

```tsx
import { RollingShoreExperience } from '@/components/assists/rolling-shore';

export default function Page() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#5c5668]">
      <RollingShoreExperience />
    </main>
  );
}
```

Use `dynamic(..., { ssr: false })` if you import the experience from a Server Component parent.

## 4. Config & tuning

**Quick config** — `components/assists/rolling-shore/rollingShoreConfig.ts`:

```ts
export const ROLLING_SHORE_CONFIG = {
  soundButtonEnabled: true, // false = no mic button, no audio UI
} as const;
```

**Scene tuning:**

- **Waves / color / sand blend:** `shaders/rollingShoreShader.ts`
- **Sky:** `RollingShoreSky.tsx`, sky uniforms on `RollingShoreSurface.tsx`
- **Camera:** `RollingShoreScene.tsx` — `CAMERA_POS` / `LOOK_AT`
- **Sand tile scale:** `SAND_REPEAT` in `RollingShoreSurface.tsx`
- **Audio UI:** `OceanWavesSoundToggle.tsx` (lower-right when enabled)

## 5. Not included (Vaxion demo site only)

The homepage **close** button, black circle expand transition, and three-round showcase row are **not** in this bundle. They live in the seller’s marketing site — add your own navigation and CTAs.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Blank canvas | `ssr: false`, WebGL enabled, parent `h-dvh` |
| Sand missing | `sand03-seamless.png` in `public/` |
| No sound | User must tap mic (browser autoplay policy); `ocean-waves.mp3` in `public/` |

---

**Support:** [@VaxionStudios](https://x.com/VaxionStudios) on X.
