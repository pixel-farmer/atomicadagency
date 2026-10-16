'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PRINTER_SIZE, type MachineSpec } from '@/components/assists/the-room/server/serverRoomConfig';
import { display, drawPaper, MAX_SHEETS, registerMachine } from '@/components/assists/the-room/server/serverDisplays';
import { canvasTexture, getSharedParts } from '@/components/assists/the-room/server/serverTextures';

const { width: W, height: H, depth: D } = PRINTER_SIZE;
const SHEET_THICKNESS = 0.015;

/** Prints every edit on green-bar paper; a sheet drops onto the pile every 30 lines. */
export function LinePrinter({ spec }: { spec: MachineSpec }) {
  const parts = getSharedParts();
  const group = useRef<THREE.Group>(null);
  const sheets = useRef<(THREE.Mesh | null)[]>([]);
  const paper = useMemo(() => canvasTexture(172, 200), []);
  const state = useRef({ version: -1, scroll: 0, frame: 0 });
  // Fixed jitter per sheet so the pile looks hand-stacked.
  const jitter = useMemo(
    () => Array.from({ length: MAX_SHEETS }, () => ({ x: (Math.random() - 0.5) * 0.04, r: (Math.random() - 0.5) * 0.08 })),
    [],
  );

  useLayoutEffect(() => {
    if (!group.current) return;
    return registerMachine(spec.id, group.current);
  }, [spec.id]);
  useEffect(() => () => paper.texture.dispose(), [paper]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    s.frame++;
    s.scroll += Math.min(rawDelta, 0.05) * 60;
    if (s.version !== display.paperVersion || s.frame % 4 === 0) {
      s.version = display.paperVersion;
      drawPaper(paper, s.scroll);
    }
    sheets.current.forEach((sheet, i) => {
      if (sheet) sheet.visible = i < display.sheets;
    });
  });

  return (
    <group ref={group} position={[spec.x, 0, spec.z]} rotation-y={spec.rotationY} userData={{ machineId: spec.id }}>
      <mesh position-y={H / 2}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#d4d3ce" roughness={0.55} />
      </mesh>
      <mesh position={[0, H + 0.04, -0.18]}>
        <boxGeometry args={[W + 0.02, 0.08, 0.5]} />
        <meshStandardMaterial color="#9b9c9e" roughness={0.5} />
      </mesh>
      <mesh position={[0, H + 0.01, 0.14]} material={parts.materials.speaker}>
        <boxGeometry args={[1.0, 0.03, 0.1]} />
      </mesh>
      <mesh position={[0, H + 0.5, 0.12]} rotation-x={-0.14}>
        <planeGeometry args={[0.86, 1.0]} />
        <meshBasicMaterial map={paper.texture} side={THREE.DoubleSide} />
      </mesh>

      {jitter.map((j, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sheets.current[i] = el;
          }}
          visible={false}
          position={[j.x, SHEET_THICKNESS / 2 + i * SHEET_THICKNESS, D / 2 + 0.33]}
          rotation-y={j.r}
          material={parts.materials.paper}
        >
          <boxGeometry args={[0.8, SHEET_THICKNESS, 0.56]} />
        </mesh>
      ))}

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0.2]} renderOrder={2} material={parts.materials.shadow}>
        <planeGeometry args={[W + 0.8, D + 1.2]} />
      </mesh>
    </group>
  );
}
