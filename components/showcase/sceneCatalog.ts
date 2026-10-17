/** Homepage scene tiles. Adding a scene starts here. */
export const sceneCatalog = [
  {
    slug: 'black-water-koi',
    title: 'Black Water Koi',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/black-water-koi.webp',
    /** White type on the black pond. */
    closeTone: 'light',
    /** Shown on the scene page with a buy link. */
    product: {
      blurb:
        'A drop-in, full-viewport 3D koi pond for Next.js and React Three Fiber: dark shader water, rain ripples, and a configurable school of animated koi. Built for landing pages, hero sections, and portfolio sites where you want calm motion without a heavy video file.',
      buyLabel: 'Get Black Water Koi on Gumroad',
      buyUrl: 'https://vaxionstudios.gumroad.com/l/blackwaterkoi',
    },
  },
  {
    slug: 'ocean-waves',
    title: 'Ocean Waves',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/ocean-waves.webp',
    /** Dark type on the pale shore. */
    closeTone: 'dark',
    product: {
      blurb:
        'A drop-in, full-viewport moody shore for Next.js and React Three Fiber: shader rolling swells, tiled sand, soft sky, and optional looped wave audio with a mic toggle you can hide in config. Built for hero sections and landing pages without a heavy video file.',
      buyLabel: 'Get Ocean Waves on Gumroad',
      buyUrl: 'https://vaxionstudios.gumroad.com/l/oceanwaves',
    },
  },
  {
    slug: 'starfield',
    title: 'Starfield',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/starfield.webp',
    /** White type on the night sky. */
    closeTone: 'light',
  },
  {
    slug: 'the-room',
    title: 'The Mainframe', 
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/the-room.webp',
    /** Opens the stand-alone page instead of /scenes/the-room, so it can be shared directly. */
    href: '/explore/mainframe',
    /** White type on the dark server room. */
    closeTone: 'light',
  },
  {
    slug: 'open-field',
    title: 'The Glass Bead',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/open-field.webp',
    /** Dark type on the pale field. */
    closeTone: 'dark',
  },
  {
    slug: 'sapphires',
    title: 'Sapphires',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/sapphires.webp',
    /** White type on the dark navy frame. */
    closeTone: 'light',
  },
] as const;

export type CloseTone = (typeof sceneCatalog)[number]['closeTone'];

export type SceneSlug = (typeof sceneCatalog)[number]['slug'];
