/** Homepage scene tiles. Adding a scene starts here. */
export const sceneCatalog = [
  {
    slug: 'black-water-koi',
    title: 'Black Water Koi',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/black-water-koi.webp',
    /** White type on the black pond. */
    closeTone: 'light',
  },
  {
    slug: 'ocean-waves',
    title: 'Ocean Waves',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/ocean-waves.webp',
    /** Dark type on the pale shore. */
    closeTone: 'dark',
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
    title: 'The Room',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/the-room.webp',
    /** Dark type on the daylight room. */
    closeTone: 'dark',
  },
  {
    slug: 'open-field',
    title: 'Open Field',
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
