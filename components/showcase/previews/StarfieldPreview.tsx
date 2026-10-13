'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function StarfieldPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Starfield scene.
  return <PreviewStub color="#cbb98a" onReady={onReady} />;
}
