import type { Metadata, Viewport } from 'next';
import { ExploreMainframe } from '@/app/explore/mainframe/ExploreMainframe';

// TODO: replace public/og/mainframe.jpg with a 1200x630 screenshot.
const ogImage = '/og/mainframe.jpg';
const title = 'The Mainframe — Vaxion Studios';
const description = 'A retro server room running on live Wikipedia edits.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [ogImage] },
  twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MainframeExplorePage() {
  return <ExploreMainframe />;
}
