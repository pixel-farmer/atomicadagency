'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function BlackWaterKoiPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Black Water Koi scene.
  return <PreviewStub color="#1a4a6e" onReady={onReady} />;
} 