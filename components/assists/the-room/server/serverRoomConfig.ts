import * as THREE from 'three';

/** Room size in meters. The camera walks inside these bounds. */
export const SERVER_ROOM = { width: 18, depth: 20, height: 6.5 } as const;
export const EYE_HEIGHT = 1.65;
export const START_POSITION = new THREE.Vector3(0.8, EYE_HEIGHT, 7.5);

export const PALETTE = {
  background: '#0d0e0f',
  ink: '#e9e8e2',
  amber: '#f29a1f',
  alert: '#ff2a18',
  cabinet: '#252629',
  frame: '#e8e8e5',
  speaker: '#141516',
  grout: '#7d7f83',
  wallDark: '#2c2d30',
  wallLight: '#c3c4c7',
  ceiling: '#1c1d1f',
  column: '#38393c',
  poster: '#c4362a',
} as const;

/** Cabinet box. Match these when the mesh model replaces the box, or move the anchors below. */
export const CABINET = { width: 1.1, height: 2.0, depth: 1.2 } as const;

/**
 * Where the live parts sit on a cabinet, in the cabinet's local space (front face is +Z).
 * A modeled cabinet can keep these, or export empties with the same names and read them instead.
 */
export const ANCHORS = {
  screen: { y: 1.0, width: 0.92, height: 0.72 },
  vent: { y: 1.48, width: 0.92, height: 0.11 },
  led: { y: 1.72, width: 0.92, height: 0.23 },
  tag: { x: 0.28, y: 2.07, z: 0.48 },
  reels: { y: 1.04, spread: 0.23, radius: 0.2 },
} as const;

/** What each monitor shows. The order is the order they are handed out along the rows. */
export const SCREEN_PROGRAMS = [
  { name: 'Language bars', description: 'Edits per language over the last 60 seconds' },
  { name: 'Log terminal', description: 'Every edit printed as it lands' },
  { name: 'Operator', description: 'The little operator jumps when traffic spikes' },
  { name: 'Byte scope', description: 'Bytes added (up) and removed (down) per edit' },
  { name: 'Counter', description: 'Edits since you walked in' },
  { name: 'Globe', description: 'A ping for every edit, worldwide' },
  { name: 'Bot ratio', description: 'Human editors versus bots' },
] as const;

export type MachineKind = 'screen' | 'tape' | 'printer';

export type MachineSpec = {
  id: string;
  kind: MachineKind;
  x: number;
  z: number;
  rotationY: number;
  /** Index into SCREEN_PROGRAMS, for screens only. */
  program?: number;
};

function buildLayout(): MachineSpec[] {
  const machines: MachineSpec[] = [];
  let program = 0;
  const add = (kind: MachineKind, x: number, z: number, rotationY: number) => {
    const id = `${kind}-${machines.length}`;
    machines.push({ id, kind, x, z, rotationY, program: kind === 'screen' ? program++ % SCREEN_PROGRAMS.length : undefined });
  };
  const step = CABINET.width + 0.02;

  // Row A: a long bank facing the entrance, with an end cap turned sideways.
  for (let i = 0; i < 7; i++) add('screen', -4.4 + i * step, 0, 0);
  add('screen', -4.4 + 6 * step + CABINET.width / 2 + CABINET.depth / 2 + 0.05, -0.05, Math.PI / 2);

  // Row B: further back, ending in the tape drive and another end cap.
  for (let i = 0; i < 7; i++) add(i === 6 ? 'tape' : 'screen', -1.6 + i * step, -5, 0);
  add('screen', -1.6 + 6 * step + CABINET.width / 2 + CABINET.depth / 2 + 0.05, -5.05, Math.PI / 2);

  machines.push({ id: 'printer', kind: 'printer', x: 5.6, z: 2.6, rotationY: -0.55 });
  return machines;
}

export const MACHINES = buildLayout();
export const MACHINE_BY_ID = new Map(MACHINES.map((m) => [m.id, m]));

export const PRINTER_SIZE = { width: 1.3, height: 0.9, depth: 0.9 } as const;

export type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Floor footprints the camera can't walk through. Rotated machines get their bounding box. */
export const OBSTACLES: Obstacle[] = MACHINES.map((m) => {
  const size = m.kind === 'printer' ? PRINTER_SIZE : CABINET;
  // Printers have their paper pile out front, so their footprint reaches a bit further.
  const hx = size.width / 2;
  const hz = size.depth / 2 + (m.kind === 'printer' ? 0.25 : 0);
  const c = Math.abs(Math.cos(m.rotationY));
  const s = Math.abs(Math.sin(m.rotationY));
  const ex = c * hx + s * hz;
  const ez = s * hx + c * hz;
  return { minX: m.x - ex, maxX: m.x + ex, minZ: m.z - ez, maxZ: m.z + ez };
});

export function describeMachine(spec: MachineSpec) {
  if (spec.kind === 'tape') {
    return { name: 'Tape drive', description: 'Left reel spins with human edits, right reel with bot edits' };
  }
  if (spec.kind === 'printer') {
    return { name: 'Line printer', description: 'Prints every edit. The paper pile grows as you watch' };
  }
  return SCREEN_PROGRAMS[spec.program ?? 0];
}

/** A monitor's canvas size in pixels. */
export const SCREEN_PX = { width: 256, height: 200 } as const;
/** How close you need to be, in meters, for the HUD to describe the machine you're facing. */
export const FOCUS_DISTANCE = 4.5;
/** An edit that adds or removes at least this many bytes sets off the red alert. */
export const ALERT_BYTES = 50_000;
export const ALERT_SECONDS = 3.4;
export const ALERT_COOLDOWN_SECONDS = 20;
