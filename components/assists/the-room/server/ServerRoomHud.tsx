'use client';

import { describeMachine, MACHINE_BY_ID } from '@/components/assists/the-room/server/serverRoomConfig';
import { hudAlert, hudFocus, useStore } from '@/components/assists/the-room/server/serverStore';
import { feedStats } from '@/components/assists/the-room/server/wikiFeed';

const GUTTER = 'px-[clamp(1rem,4vw,2.5rem)]';
const LABEL = 'text-[10px] font-light uppercase tracking-[0.3em] text-[#ecebe6]/55';
const PANEL = 'rounded-sm border border-white/10 bg-[#121314]/70 backdrop-blur-sm';

function SourceChip() {
  const { source } = useStore(feedStats);
  const dot =
    source === 'live'
      ? 'bg-[#7fd59a] shadow-[0_0_8px_#7fd59a]'
      : source === 'sample'
        ? 'bg-[#f29a1f] animate-pulse motion-reduce:animate-none'
        : 'bg-[#94969a]';
  const text = source === 'live' ? 'Live · Wikipedia' : source === 'sample' ? 'Sample feed · reconnecting' : 'Connecting';
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className={LABEL}>{text}</span>
    </div>
  );
}

function Stats() {
  const stats = useStore(feedStats);
  const items = [
    ['Edits · last 60s', stats.rate.toLocaleString('en-US')],
    ['Bot share', `${Math.round(stats.botShare * 100)}%`],
    ['Wikis active', stats.wikis.toLocaleString('en-US')],
    ['New pages', stats.newPages.toLocaleString('en-US')],
  ] as const;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className={LABEL}>{label}</dt>
          <dd className="font-mono text-lg font-light tabular-nums text-[#ecebe6]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FocusCard() {
  const focus = useStore(hudFocus);
  const spec = focus ? MACHINE_BY_ID.get(focus) : undefined;
  if (!spec) return null;
  const { name, description } = describeMachine(spec);
  return (
    <div className={`${PANEL} max-w-[min(18rem,calc(100vw-2rem))] px-4 py-3`}>
      <p className="text-[11px] font-normal uppercase tracking-[0.3em] text-[#f29a1f]">{name}</p>
      <p className="mt-1 text-sm font-light leading-snug text-[#ecebe6]">{description}</p>
      <p className={`mt-2 ${LABEL}`}>Fed by Wikipedia recent changes</p>
    </div>
  );
}

function AlertBanner() {
  const alert = useStore(hudAlert);
  if (!alert) return null;
  return (
    <div className="absolute inset-x-0 top-[28%] flex justify-center px-4">
      <p
        role="status"
        className="rounded-sm bg-[#d93a2b] px-4 py-2 text-center text-xs font-normal uppercase tracking-[0.25em] text-white"
      >
        {alert}
      </p>
    </div>
  );
}

/** DOM overlay for the server room. The close button owns the top-right corner. */
export function ServerRoomHud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-sans">
      <div className={`${GUTTER} pt-[clamp(1.25rem,4vh,2.5rem)] pr-36`}>
        <h1 className="text-[clamp(1.1rem,2.4vw,1.75rem)] font-extralight uppercase tracking-[0.35em] text-[#ecebe6]">
          The Mainframe
        </h1>
        <div className="mt-2">
          <SourceChip />
        </div>
        <Stats />
      </div>
      <AlertBanner />
      {/* Sits above the sound button; on phones, also above the joystick and the hint line. */}
      <div className={`absolute bottom-[calc(clamp(1.25rem,4vh,2.5rem)+10rem)] right-0 sm:bottom-[calc(clamp(1.25rem,4vh,2.5rem)+3.5rem)] ${GUTTER}`}>
        <FocusCard />
      </div>
    </div>
  );
}
