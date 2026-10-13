import type { Metadata, Viewport } from 'next';
import { PlayGlassBead } from '@/app/play/glass-bead/PlayGlassBead';

// TODO: replace public/og/glass-bead.jpg with a 1200x630 screenshot.
const ogImage = '/og/glass-bead.jpg';

export const metadata: Metadata = {
  title: 'The Glass Bead — Vaxion Studios',
  description: 'Roll a glass ball through the grass.',
  openGraph: {
    title: 'The Glass Bead — Vaxion Studios',
    description: 'Roll a glass ball through the grass.',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Glass Bead — Vaxion Studios',
    description: 'Roll a glass ball through the grass.',
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function GlassBeadPlayPage() {
  return <PlayGlassBead />;
}
