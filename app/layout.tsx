import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import Script from 'next/script';
import { SmoothScroll } from '@/components/marketing/SmoothScroll';
import { ScenePreviewRoot } from '@/components/showcase/ScenePreviewCanvas';
import './globals.css';

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-93K1JVPBKW';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vaxion Studios',
  description:
    'Vaxion Studios builds interactive 3D for the web with WebGL and React Three Fiber: shader scenes, product showcases, and immersive brand experiences.',
  openGraph: {
    title: 'Vaxion Studios',
    description: 'Interactive 3D for the web, built with WebGL and React Three Fiber.',
    url: 'https://www.vaxionstudios.com',
    siteName: 'Vaxion Studios',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${outfit.className}`}>
      <body className={`${outfit.className} min-h-screen font-sans antialiased`}>
        <ScenePreviewRoot>
          <SmoothScroll>{children}</SmoothScroll>
        </ScenePreviewRoot>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Analytics />
      </body>
    </html>
  );
}
