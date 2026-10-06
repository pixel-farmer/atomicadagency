/**
 * Builds gumroad/ocean-waves-bundle/ for upload to Gumroad.
 * Run: npm run package:ocean
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'gumroad', 'ocean-waves-bundle');

const ASSIST = path.join(root, 'components', 'assists', 'rolling-shore');
const CANVAS = path.join(root, 'components', 'canvas');
const PUBLIC = path.join(root, 'public');

const ASSETS = ['sand03-seamless.png', 'ocean-waves.mp3'];

const ASSIST_FILES = [
  'RollingShoreExperience.tsx',
  'RollingShoreScene.tsx',
  'RollingShoreSurface.tsx',
  'RollingShoreSky.tsx',
  'OceanWavesSoundToggle.tsx',
  'rollingShoreConfig.ts',
  'index.ts',
  'shaders/rollingShoreShader.ts',
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
      className="flex h-full min-h-[200px] w-full items-center justify-center bg-[#5c5668]"
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

const RollingShoreExperience = dynamic(
  () =>
    import('@/components/assists/rolling-shore').then((m) => m.RollingShoreExperience),
  { ssr: false },
);

/**
 * Example full-viewport page. Copy into app/ (App Router) or pages/ (Pages Router).
 * No demo "close" button — add your own nav / CTAs in a layer above the scene.
 */
export default function OceanWavesPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#5c5668]">
      <RollingShoreExperience />
    </main>
  );
}
`;

const LICENSE_SRC = path.join(root, 'gumroad', 'OCEAN-WAVES-LICENSE.md');

const INSTALL = `# Ocean Waves — Install guide

Full-viewport moody beach for Next.js + React Three Fiber: shader swells, sand texture, optional looped wave audio.

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

Example versions:

\`\`\`json
"three": "^0.170.0",
"@react-three/fiber": "^9.0.0",
"@react-three/drei": "^10.0.0"
\`\`\`

Tailwind CSS is **optional** — class names are plain strings; swap for your own CSS if needed.

## 2. Copy files

| Bundle path | Your project |
|-------------|----------------|
| \`components/assists/rolling-shore/\` | \`components/assists/rolling-shore/\` |
| \`components/canvas/\` | \`components/canvas/\` |
| \`public/sand03-seamless.png\` | \`public/sand03-seamless.png\` |
| \`public/ocean-waves.mp3\` | \`public/ocean-waves.mp3\` |

Keep the \`@/components/...\` import paths — they match the layout above.

## 3. Run the example page

Copy \`example/OceanWavesPage.tsx\` to e.g. \`app/ocean/page.tsx\` and visit \`/ocean\`.

Or mount anywhere:

\`\`\`tsx
import { RollingShoreExperience } from '@/components/assists/rolling-shore';

export default function Page() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#5c5668]">
      <RollingShoreExperience />
    </main>
  );
}
\`\`\`

Use \`dynamic(..., { ssr: false })\` if you import the experience from a Server Component parent.

## 4. Config & tuning

**Quick config** — \`components/assists/rolling-shore/rollingShoreConfig.ts\`:

\`\`\`ts
export const ROLLING_SHORE_CONFIG = {
  soundButtonEnabled: true, // false = no mic button, no audio UI
} as const;
\`\`\`

**Scene tuning:**

- **Waves / color / sand blend:** \`shaders/rollingShoreShader.ts\`
- **Sky:** \`RollingShoreSky.tsx\`, sky uniforms on \`RollingShoreSurface.tsx\`
- **Camera:** \`RollingShoreScene.tsx\` — \`CAMERA_POS\` / \`LOOK_AT\`
- **Sand tile scale:** \`SAND_REPEAT\` in \`RollingShoreSurface.tsx\`
- **Audio UI:** \`OceanWavesSoundToggle.tsx\` (lower-right when enabled)

## 5. Not included (Vaxion demo site only)

The homepage **close** button, black circle expand transition, and three-round showcase row are **not** in this bundle. They live in the seller’s marketing site — add your own navigation and CTAs.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Blank canvas | \`ssr: false\`, WebGL enabled, parent \`h-dvh\` |
| Sand missing | \`sand03-seamless.png\` in \`public/\` |
| No sound | User must tap mic (browser autoplay policy); \`ocean-waves.mp3\` in \`public/\` |

---

**Support:** [@VaxionStudios](https://x.com/VaxionStudios) on X.
`;

const MANIFEST = {
  name: 'ocean-waves',
  description: 'Next.js R3F assist — rolling shore, shader water, sand, optional wave audio',
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

for (const file of ASSIST_FILES) {
  copyFile(path.join(ASSIST, file), path.join(out, 'components', 'assists', 'rolling-shore', file));
}

for (const file of CANVAS_FILES) {
  copyFile(path.join(CANVAS, file), path.join(out, 'components', 'canvas', file));
}

writeFile(path.join(out, 'components', 'canvas', 'CanvasFallback.tsx'), CANVAS_FALLBACK);

for (const asset of ASSETS) {
  copyFile(path.join(PUBLIC, asset), path.join(out, 'public', asset));
}

writeFile(path.join(out, 'example', 'OceanWavesPage.tsx'), EXAMPLE_PAGE);
writeFile(path.join(out, 'INSTALL.md'), INSTALL);
copyFile(LICENSE_SRC, path.join(out, 'LICENSE.md'));
writeFile(path.join(out, 'manifest.json'), JSON.stringify(MANIFEST, null, 2) + '\n');

writeFile(
  path.join(out, 'README.md'),
  `# Ocean Waves (Gumroad bundle)

Read **LICENSE.md** and **INSTALL.md** first.

Quick tree:

- \`components/assists/rolling-shore/\` — scene source
- \`components/canvas/\` — thin Next.js canvas shell (required)
- \`public/\` — sand texture + wave audio
- \`example/\` — sample page (no demo close button)

Zip this folder as \`gumroad/ocean-waves-bundle.zip\` for Gumroad upload.
`,
);

console.log('Bundle written to:', out);
console.log('Assets:', ASSETS.join(', '));
