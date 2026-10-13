import type { Metadata, Viewport } from 'next';
import { PlayOpenField } from '@/app/play/open-field/PlayOpenField';

// TODO: replace public/og/open-field.jpg with a 1200x630 screenshot.
const ogImage = '/og/open-field.jpg';

export const metadata: Metadata = {
  title: 'Open Field — Vaxion Studios',
  description: 'Roll a glass ball through the grass.',
  openGraph: {
    title: 'Open Field — Vaxion Studios',
    description: 'Roll a glass ball through the grass.',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Open Field — Vaxion Studios',
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

export default function OpenFieldPlayPage() {
  return <PlayOpenField />;
}
