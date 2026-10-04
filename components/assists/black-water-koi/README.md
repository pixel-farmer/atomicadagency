# BlackWaterKoi

Self-contained React Three Fiber assist: rain ripples, shader water, and a configurable koi school.

## Included in this folder

- `BlackWaterKoiExperience` — drop-in full-size canvas shell
- `BlackWaterKoiScene`, `BlackWaterSurface`, `BlackWaterKoiFish`
- `koiSchoolConfig.ts` — fish count, diffuse maps, spawn, depth, speed
- `shaders/blackWaterShader.ts`
- Public assets: `koi_fish_ow.glb`, `koi-diffuse-*.png` (paths referenced in config)

## Not included (demo site only)

The **close** button, black circle expand/shrink transition, and homepage thumbnails live in **`components/showcase/AssistShowcaseRow.tsx`**. That is Vaxion’s preview chrome, not part of this product.

Buyers add their own layout, headlines, navigation, and CTAs over or beside `BlackWaterKoiExperience`.

## Quick use

```tsx
import { BlackWaterKoiExperience } from '@/components/assists/black-water-koi';

export default function Page() {
  return (
    <main className="relative h-dvh w-full">
      <BlackWaterKoiExperience />
      {/* Your headline / copy in an absolute layer with pointer-events-none */}
    </main>
  );
}
```

Edit `KOI_SCHOOL` in `koiSchoolConfig.ts` to change population and textures.

## Seller: Gumroad bundle

From repo root: `npm run package:koi` → `gumroad/black-water-koi-bundle/` and `gumroad/black-water-koi-bundle.zip` for upload. Edit `gumroad/BLACK-WATER-KOI-LICENSE.md` before packaging.
