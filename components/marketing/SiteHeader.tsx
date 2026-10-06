import Link from 'next/link';

const nav = [
  { href: '/rabbit', label: 'Rabbit' },
  { href: '/arcade', label: 'Arcade' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-deep/75 px-[clamp(1rem,4vw,2.5rem)] py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="font-sans text-lg font-semibold tracking-tight text-white transition hover:text-accent"
        >
          Atomic
        </Link>
        <nav className="flex items-center gap-8" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
