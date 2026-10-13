'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function OceanWavesPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Ocean Waves scene.
  return <PreviewStub color="#7f93a4" onReady={onReady} />;
}
