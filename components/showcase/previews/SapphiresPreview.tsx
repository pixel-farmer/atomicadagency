'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function SapphiresPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Sapphires scene.
  return <PreviewStub color="#2450c8" onReady={onReady} />;
}
