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
      <footer className="relative z-[2] flex flex-row flex-nowrap items-center justify-center gap-10 px-[clamp(1rem,4vw,2.5rem)] pb-16 pt-2 text-center">
        <p className="font-sans text-[11px] font-extralight uppercase tracking-[0.35em] text-white/75">
          Social
        </p>
        <nav className="flex flex-nowrap items-center gap-x-10" aria-label="Social">
          <a
            href="https://x.com/vaxionstudios"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[13px] font-extralight uppercase tracking-[0.22em] text-white transition hover:text-white/70"
          >
            X
          </a>
          <a
            href="https://www.instagram.com/vaxionstudios/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[13px] font-extralight uppercase tracking-[0.22em] text-white transition hover:text-white/70"
          >
            Instagram
          </a>
        </nav>
      </footer>
    </main>
  );
}
