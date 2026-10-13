'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function OpenFieldPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Open Field scene.
  return <PreviewStub color="#6f8f66" onReady={onReady} />;
}
