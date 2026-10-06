# Rolling Shore

Full-viewport moody beach — rolling ocean swells, pale foam lines, wet sand foreground. Shader-driven water + **`public/sand03-seamless.png`** tiled on the beach zone.

## Dev

```tsx
import { RollingShoreExperience } from '@/components/assists/rolling-shore';

export default function Page() {
  return <RollingShoreExperience />;
}
```

## Config

`rollingShoreConfig.ts` — set `soundButtonEnabled: false` to hide the mic toggle and skip wave audio UI.

## Tuning

- **Waves:** `shaders/rollingShoreShader.ts` — `waveHeight()` frequencies and shore mask.
- **Camera:** `RollingShoreScene.tsx` — `CAMERA_POS` / `LOOK_AT`.
- **Palette:** sky uniforms on `RollingShoreSurface` + `RollingShoreSky`.

Homepage showcase: second round assist (`assistIndex === 1`).

Gumroad: `npm run package:ocean` → `gumroad/ocean-waves-bundle/` (+ zip). License source: `gumroad/OCEAN-WAVES-LICENSE.md`.
