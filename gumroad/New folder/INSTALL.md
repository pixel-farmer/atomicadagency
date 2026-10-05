# BlackWaterKoi — Install guide

React Three Fiber scene for Next.js: shader water, rain ripples, configurable koi school.

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

Use versions compatible with your Next/React stack, for example:

```json
"three": "^0.170.0",
"@react-three/fiber": "^9.0.0",
"@react-three/drei": "^10.0.0"
```

Tailwind CSS is **optional** — class names are plain strings; swap for your own CSS if needed.

## 2. Copy files

From this zip into your project:

| Bundle path | Your project |
|-------------|----------------|
| `components/assists/black-water-koi/` | `components/assists/black-water-koi/` |
| `components/canvas/` | `components/canvas/` |
| `public/koi_fish_ow.glb` | `public/koi_fish_ow.glb` |
| `public/koi-diffuse-*.png` | `public/` (same filenames) |

Keep the `@/components/...` import paths — they match the layout above.

## 3. Run the example page

Copy `example/BlackWaterKoiPage.tsx` to e.g. `app/koi/page.tsx` (App Router) and visit `/koi`.

Or mount anywhere:

```tsx
import { BlackWaterKoiExperience } from '@/components/assists/black-water-koi';

export default function Page() {
  return (
    <div className="relative h-dvh w-full">
      <BlackWaterKoiExperience />
    </div>
  );
}
```

Use `dynamic(..., { ssr: false })` if you import the experience from a Server Component parent.

## 4. Configure the school

Edit `components/assists/black-water-koi/koiSchoolConfig.ts`:

- `KOI_SCHOOL` — up to 4 entries (duplicate a block for a fourth fish)
- `diffuse` — paths to PNG textures (same UVs as the included GLB)
- `spawn`, `swimDepth` (typically **0.4–0.9**), `speedScale`, `lengthScale`, `animPhase`

See comments in that file for `swimDepth` vs horizontal spacing.

## 5. Not included (Vaxion demo site only)

The homepage **close** button, black circle transition, and thumbnail row are **not** in this bundle. They live in the seller’s marketing site showcase — add your own navigation and CTAs.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Blank / black canvas | Assets in `public/`, `ssr: false`, browser WebGL |
| Textures missing | PNG paths in `koiSchoolConfig` match `public/` filenames |
| Type errors on `three` | `npm i -D @types/three` |

---

**Support:** for help, updates, or custom requests, reach out on X [@VaxionStudios](https://x.com/VaxionStudios).
