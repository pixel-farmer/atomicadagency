/** Homepage scene tiles. Adding a scene starts here. */
export const sceneCatalog = [
  {
    slug: 'black-water-koi',
    title: 'Black Water Koi',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/black-water-koi.webp',
  },
  {
    slug: 'ocean-waves',
    title: 'Ocean Waves',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/ocean-waves.webp',
  },
  {
    slug: 'starfield',
    title: 'Starfield',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/starfield.webp',
  },
  {
    slug: 'the-room',
    title: 'The Room',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/the-room.webp',
  },
  {
    slug: 'open-field',
    title: 'Open Field',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/open-field.webp',
  },
  {
    slug: 'sapphires',
    title: 'Sapphires',
    // TODO: replace the generated placeholder in /public/posters with a real still.
    poster: '/posters/sapphires.webp',
  },
] as const;

export type SceneSlug = (typeof sceneCatalog)[number]['slug'];
