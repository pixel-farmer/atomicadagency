/**
 * Builds gumroad/black-water-koi-bundle/ for upload to Gumroad.
 * Run: npm run package:koi
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'gumroad', 'black-water-koi-bundle');

const KOI_ASSIST = path.join(root, 'components', 'assists', 'black-water-koi');
const CANVAS = path.join(root, 'components', 'canvas');
const PUBLIC = path.join(root, 'public');

const ASSETS = [
  'koi_fish_ow.glb',
  'koi-diffuse-ow.png',
  'koi-diffuse-gray.png',
  'koi-diffuse-charcoal.png',
];

const KOI_FILES = [
  'BlackWaterKoiExperience.tsx',
  'BlackWaterKoiScene.tsx',
  'BlackWaterKoiFish.tsx',
  'BlackWaterSurface.tsx',
  'koiSchoolConfig.ts',
  'koiSchoolPositions.ts',
  'index.ts',
  'shaders/blackWaterShader.ts',
];

const CANVAS_FILES = ['CanvasWrapper.tsx', 'InnerCanvas.tsx', 'index.ts'];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeFile(dest, content) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
}

const CANVAS_FALLBACK = `'use client';

/** Shown while the WebGL canvas chunk loads (Next.js dynamic import). */
export function CanvasFallback() {
  return (
    <div
      className="flex h-full min-h-[200px] w-full items-center justify-center bg-black"
      aria-hidden
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
        role="presentation"
      />
      <span className="sr-only">Loading scene</span>
    </div>
  );
}
`;

const EXAMPLE_PAGE = `'use client';

import dynamic from 'next/dynamic';

const BlackWaterKoiExperience = dynamic(
  () =>
    import('@/components/assists/black-water-koi').then((m) => m.BlackWaterKoiExperience),
  { ssr: false },
);

/**
 * Example full-viewport page. Copy into app/ (App Router) or pages/ (Pages Router).
 * Add your headline in an absolute layer above the experience.
 */
export default function BlackWaterKoiPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <BlackWaterKoiExperience />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-sans text-3xl font-light tracking-wide text-white/90">
          Your headline
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm text-white/60">
          Your supporting copy — pointer-events-none on this layer keeps the canvas passive.
        </p>
      </div>
    </main>
  );
}
`;

const LICENSE_SRC = path.join(root, 'gumroad', 'BLACK-WATER-KOI-LICENSE.md');

const INSTALL = `# BlackWaterKoi — Install guide

React Three Fiber scene for Next.js: shader water, rain ripples, configurable koi school.

**Version:** packaged from Vaxion Studios assist  

**License:** read **LICENSE.md** in this zip before use. Single-seat license — **no reselling or redistributing** the source or assets.

---

## Requirements

- **Next.js** 13+ (App Router recommended) or compatible React 18+ setup
- **TypeScript** recommended (files are \`.tsx\`)
- Path alias \`@/*\` → project root (default in Next.js)

## 1. Install dependencies

\`\`\`bash
npm install three @react-three/fiber @react-three/drei
\`\`\`

Use versions compatible with your Next/React stack, for example:

\`\`\`json
"three": "^0.170.0",
"@react-three/fiber": "^9.0.0",
"@react-three/drei": "^10.0.0"
\`\`\`

Tailwind CSS is **optional** — class names are plain strings; swap for your own CSS if needed.

## 2. Copy files

From this zip into your project:

| Bundle path | Your project |
|-------------|----------------|
| \`components/assists/black-water-koi/\` | \`components/assists/black-water-koi/\` |
| \`components/canvas/\` | \`components/canvas/\` |
| \`public/koi_fish_ow.glb\` | \`public/koi_fish_ow.glb\` |
| \`public/koi-diffuse-*.png\` | \`public/\` (same filenames) |

Keep the \`@/components/...\` import paths — they match the layout above.

## 3. Run the example page

Copy \`example/BlackWaterKoiPage.tsx\` to e.g. \`app/koi/page.tsx\` (App Router) and visit \`/koi\`.

Or mount anywhere:

\`\`\`tsx
import { BlackWaterKoiExperience } from '@/components/assists/black-water-koi';

export default function Page() {
  return (
    <div className="relative h-dvh w-full">
      <BlackWaterKoiExperience />
    </div>
  );
}
\`\`\`

Use \`dynamic(..., { ssr: false })\` if you import the experience from a Server Component parent.

## 4. Configure the school

Edit \`components/assists/black-water-koi/koiSchoolConfig.ts\`:

- \`KOI_SCHOOL\` — up to 4 entries (duplicate a block for a fourth fish)
- \`diffuse\` — paths to PNG textures (same UVs as the included GLB)
- \`spawn\`, \`swimDepth\` (typically **0.4–0.9**), \`speedScale\`, \`lengthScale\`, \`animPhase\`

See comments in that file for \`swimDepth\` vs horizontal spacing.

## 5. Not included (Vaxion demo site only)

The homepage **close** button, black circle transition, and thumbnail row are **not** in this bundle. They live in the seller’s marketing site showcase — add your own navigation and CTAs.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Blank / black canvas | Assets in \`public/\`, \`ssr: false\`, browser WebGL |
| Textures missing | PNG paths in \`koiSchoolConfig\` match \`public/\` filenames |
| Type errors on \`three\` | \`npm i -D @types/three\` |

---

**Support:** for help, updates, or custom requests, reach out on X [@VaxionStudios](https://x.com/VaxionStudios).
`;

const MANIFEST = {
  name: 'black-water-koi',
  description: 'Next.js R3F assist — black water, rain ripples, koi school',
  peerDependencies: {
    next: '>=13',
    react: '>=18',
    'react-dom': '>=18',
    three: '>=0.170.0',
    '@react-three/fiber': '>=9.0.0',
    '@react-three/drei': '>=10.0.0',
  },
  publicAssets: ASSETS,
};

console.log('Cleaning', out);
rmrf(out);

for (const file of KOI_FILES) {
  const src = path.join(KOI_ASSIST, file);
  const dest = path.join(out, 'components', 'assists', 'black-water-koi', file);
  copyFile(src, dest);
}

for (const file of CANVAS_FILES) {
  copyFile(path.join(CANVAS, file), path.join(out, 'components', 'canvas', file));
}

writeFile(path.join(out, 'components', 'canvas', 'CanvasFallback.tsx'), CANVAS_FALLBACK);

for (const asset of ASSETS) {
  copyFile(path.join(PUBLIC, asset), path.join(out, 'public', asset));
}

writeFile(path.join(out, 'example', 'BlackWaterKoiPage.tsx'), EXAMPLE_PAGE);
writeFile(path.join(out, 'INSTALL.md'), INSTALL);
copyFile(LICENSE_SRC, path.join(out, 'LICENSE.md'));
writeFile(path.join(out, 'manifest.json'), JSON.stringify(MANIFEST, null, 2) + '\n');

// Short pointer in bundle root
writeFile(
  path.join(out, 'README.md'),
  `# BlackWaterKoi (Gumroad bundle)

Read **LICENSE.md** and **INSTALL.md** first.

Quick tree:

- \`components/assists/black-water-koi/\` — scene source
- \`components/canvas/\` — thin Next.js canvas shell (required)
- \`public/\` — GLB + diffuse PNGs
- \`example/\` — sample page

Zip this folder (or \`gumroad/black-water-koi-bundle\`) for Gumroad upload.
`,
);

console.log('Bundle written to:', out);
console.log('Assets:', ASSETS.join(', '));
