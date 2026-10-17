const CONTACT_EMAIL = 'cassie@pixel-farmers.com';

const SERVICES = [
  'Interactive hero sections',
  '3D product showcases',
  'Brand experiences',
  'Custom shaders & effects',
];

export function VaxionAbout() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative z-[2] flex w-full justify-center px-[clamp(1rem,4vw,2.5rem)] pb-24 pt-8"
    >
      <div className="w-full max-w-3xl text-center text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
        <h2
          id="about-heading"
          className="font-sans text-[11px] font-extralight uppercase tracking-[0.35em] text-white/75"
        >
          About
        </h2>
        <p className="mt-8 font-sans text-[clamp(1.5rem,3.5vw,2.25rem)] font-extralight leading-display-snug tracking-display-tight">
          Interactive 3D for the web.
        </p>
        <p className="mx-auto mt-6 max-w-xl font-sans text-[15px] font-light leading-relaxed text-white sm:text-base">
          I&apos;m Cassie, the developer behind Vaxion Studios. I design and build real-time WebGL
          experiences with React Three Fiber: custom shaders, physics, sound, and product scenes
          that run right in the browser. Every scene above is live and built in-house.
        </p>

        <ul className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Services">
          {SERVICES.map((service) => (
            <li
              key={service}
              className="rounded-full border border-white/30 bg-black/10 px-5 py-2.5 font-sans text-[12px] font-extralight uppercase tracking-[0.18em] text-white"
            >
              {service}
            </li>
          ))}
        </ul>

        <p className="mt-12 font-sans text-[11px] font-extralight uppercase tracking-[0.35em] text-white/75">
          Available for freelance projects
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Project%20inquiry%20via%20Vaxion%20Studios`}
          className="mt-4 inline-block border-b border-white/40 pb-1 font-sans text-[15px] font-light tracking-[0.06em] text-white transition hover:border-white hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#bd5b5b]"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </section>
  );
}
