'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { BOARD_PX, drawOpsBoard } from '@/components/assists/the-room/server/opsBoardDraw';
import { OPS_WALL, OPS_WALL_ID, PALETTE, SERVER_ROOM } from '@/components/assists/the-room/server/serverRoomConfig';
import { registerMachine } from '@/components/assists/the-room/server/serverDisplays';
import { wallView } from '@/components/assists/the-room/server/serverStore';
import { canvasTexture } from '@/components/assists/the-room/server/serverTextures';
import { feedStats } from '@/components/assists/the-room/server/wikiFeed';
import { insightsStore, startInsights } from '@/components/assists/the-room/server/wikiInsights';

/** Seconds between redraws. The numbers change once a second, so twice is plenty. */
const REDRAW_SECONDS = 0.5;
/** Slightly over 1 so the board glows a little through the bloom without blurring the text. */
const SCREEN_GLOW: [number, number, number] = [1.08, 1.08, 1.08];
/** A click that moved further than this many pixels was a drag-to-look, not a click. */
const CLICK_SLOP_PX = 8;

export { OPS_WALL_ID };

/** The large operations board on the left wall. Click it for a close-up. */
export function OpsWall() {
  const group = useRef<THREE.Group>(null);
  const board = useMemo(() => {
    const tex = canvasTexture(BOARD_PX.width, BOARD_PX.height);
    tex.texture.anisotropy = 8;
    return tex;
  }, []);
  const since = useRef(REDRAW_SECONDS);

  useEffect(() => startInsights(), []);
  useEffect(() => () => board.texture.dispose(), [board]);
  useLayoutEffect(() => {
    if (!group.current) return;
    return registerMachine(OPS_WALL_ID, group.current);
  }, []);

  useFrame((_, delta) => {
    since.current += delta;
    if (since.current < REDRAW_SECONDS) return;
    since.current = 0;
    drawOpsBoard(board.ctx, insightsStore.get(), feedStats.get().source, Date.now());
    board.texture.needsUpdate = true;
  });

  const open = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return;
    e.stopPropagation();
    wallView.set('wall');
  };

  const { width: w, height: h } = OPS_WALL;
  const wallX = -SERVER_ROOM.width / 2;

  return (
    <group
      ref={group}
      position={[wallX, OPS_WALL.centerY, OPS_WALL.centerZ]}
      rotation-y={Math.PI / 2}
      userData={{ machineId: OPS_WALL_ID }}
    >
      {/* Bezel. */}
      <mesh position-z={0.12}>
        <boxGeometry args={[w + 0.4, h + 0.4, 0.24]} />
        <meshStandardMaterial color="#1b1c1e" roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[0, h / 2 + 0.36, 0.08]}>
        <boxGeometry args={[w + 0.4, 0.16, 0.16]} />
        <meshStandardMaterial color={PALETTE.column} roughness={0.6} />
      </mesh>
      {/* Amber status strip under the screen. */}
      <mesh position={[0, -h / 2 - 0.12, 0.245]}>
        <planeGeometry args={[w * 0.18, 0.05]} />
        <meshBasicMaterial color={[1.6, 0.95, 0.2]} />
      </mesh>
      <mesh position-z={OPS_WALL.inset} onClick={open}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={board.texture} color={SCREEN_GLOW} />
      </mesh>
      {/* Cool spill from the screen onto the floor in front of it. */}
      <pointLight position={[0, -0.6, 1.4]} intensity={6} distance={8} color="#cfe0ff" />
    </group>
  );
}
