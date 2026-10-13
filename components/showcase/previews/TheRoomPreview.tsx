'use client';

import { PreviewStub } from '@/components/showcase/previews/PreviewStub';

export default function TheRoomPreview({ onReady }: { onReady?: () => void }) {
  // TODO: replace PreviewStub with the real Room scene.
  return <PreviewStub color="#9eb4c4" onReady={onReady} />;
}
