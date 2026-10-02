import { AssistShowcaseRow } from '@/components/showcase/AssistShowcaseRow';
import { VaxionHomeBackdrop } from '@/components/marketing/VaxionHomeBackdrop';
import { VaxionHomeHero } from '@/components/marketing/VaxionHomeHero';

export default function HomePage() {
  return (
    <main className="relative isolate bg-transparent">
      <VaxionHomeBackdrop />
      <section className="pointer-events-none relative z-[1] h-dvh">
        <VaxionHomeHero />
      </section>
      <AssistShowcaseRow />
    </main>
  );
}
