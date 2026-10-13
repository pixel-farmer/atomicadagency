import { notFound } from 'next/navigation';
import { sceneCatalog } from '@/components/showcase/sceneCatalog';
import { SceneStage } from '@/components/showcase/SceneStage';

export function generateStaticParams() {
  return sceneCatalog.map((scene) => ({ slug: scene.slug }));
}

export default async function ScenePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scene = sceneCatalog.find((entry) => entry.slug === slug);
  if (!scene) notFound();
  return <SceneStage slug={scene.slug} />;
}
