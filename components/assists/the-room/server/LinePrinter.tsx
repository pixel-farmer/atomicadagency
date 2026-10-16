'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type MachineSpec } from '@/components/assists/the-room/server/serverRoomConfig';
import { display, drawPaper, MAX_SHEETS, registerMachine } from '@/components/assists/the-room/server/serverDisplays';
import { canvasTexture, getSharedParts } from '@/components/assists/the-room/server/serverTextures';

/** Built by scripts/models/dot_matrix_printer.py and printer_stand.py. */
const PRINTER_URL = '/models/mainframe/dot-matrix-printer.glb';
const STAND_URL = '/models/mainframe/printer-stand.glb';
/** The printer is modelled at desk size; this scales it up to match the room's chunky style. */
const PRINTER_SCALE = 1.35;
/** How far the platen knob turns for each printed line, in radians. */
const KNOB_TURN_PER_LINE = 0.35;
/** Brightness of the POWER and pitch LEDs, so they catch the bloom. */
const LED_GLOW = 2.2;
const SHEET = { width: 0.62, thickness: 0.012, depth: 0.42 };
/** The paper canvas is 172 × 200 px, so the paper keeps that shape. */
const PAPER_ASPECT = 172 / 200;

useGLTF.preload(PRINTER_URL);
useGLTF.preload(STAND_URL);

/** The dot matrix printer on its stand. Prints every edit; finished sheets stack on the shelf. */
export function LinePrinter({ spec }: { spec: MachineSpec }) {
  return (
    <Suspense fallback={null}>
      <PrinterModel spec={spec} />
    </Suspense>
  );
}

function PrinterModel({ spec }: { spec: MachineSpec }) {
  const parts = getSharedParts();
  const printerGltf = useGLTF(PRINTER_URL);
  const standGltf = useGLTF(STAND_URL);
  const group = useRef<THREE.Group>(null);
  const sheets = useRef<(THREE.Mesh | null)[]>([]);
  const paper = useMemo(() => canvasTexture(172, 200), []);
  const state = useRef({ version: -1, scroll: 0, frame: 0, knobTarget: 0 });

  const model = useMemo(() => {
    const stand = standGltf.scene.clone(true);
    const printer = printerGltf.scene.clone(true);
    printer.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.emissiveMap) material.emissiveIntensity = LED_GLOW;
    });
    const exit = printer.getObjectByName('PaperExit');
    return {
      stand,
      printer,
      knob: printer.getObjectByName('PlatenKnob') ?? null,
      topY: stand.getObjectByName('TopSurface')?.position.y ?? 0.74,
      shelfY: stand.getObjectByName('Shelf')?.position.y ?? 0.16,
      exitPosition: exit?.position.clone() ?? new THREE.Vector3(0, 0.14, -0.07),
      tilt: (exit?.userData.tilt as number | undefined) ?? 0.33,
      paperWidth: (exit?.userData.width as number | undefined) ?? 0.25,
    };
  }, [printerGltf, standGltf]);

  // Fixed jitter per sheet so the pile looks hand-stacked.
  const jitter = useMemo(
    () => Array.from({ length: MAX_SHEETS }, () => ({ x: (Math.random() - 0.5) * 0.03, r: (Math.random() - 0.5) * 0.08 })),
    [],
  );

  useLayoutEffect(() => {
    if (!group.current) return;
    return registerMachine(spec.id, group.current);
  }, [spec.id]);
  useEffect(() => () => paper.texture.dispose(), [paper]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    s.frame++;
    s.scroll += delta * 60;
    if (s.version !== display.paperVersion) {
      if (s.version >= 0) s.knobTarget -= KNOB_TURN_PER_LINE;
      s.version = display.paperVersion;
      drawPaper(paper, s.scroll);
    } else if (s.frame % 4 === 0) {
      drawPaper(paper, s.scroll);
    }
    if (model.knob) model.knob.rotation.x += (s.knobTarget - model.knob.rotation.x) * (1 - Math.exp(-12 * delta));
    sheets.current.forEach((sheet, i) => {
      if (sheet) sheet.visible = i < display.sheets;
    });
  });

  const paperHeight = model.paperWidth / PAPER_ASPECT;

  return (
    <group ref={group} position={[spec.x, 0, spec.z]} rotation-y={spec.rotationY} userData={{ machineId: spec.id }}>
      <primitive object={model.stand} />
      <group position-y={model.topY} scale={PRINTER_SCALE}>
        <primitive object={model.printer} />
        <group position={model.exitPosition} rotation-x={-model.tilt}>
          <mesh position-y={paperHeight / 2}>
            <planeGeometry args={[model.paperWidth, paperHeight]} />
            <meshBasicMaterial map={paper.texture} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {jitter.map((j, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sheets.current[i] = el;
          }}
          visible={false}
          position={[j.x, model.shelfY + SHEET.thickness / 2 + i * SHEET.thickness, 0]}
          rotation-y={j.r}
          material={parts.materials.paper}
        >
          <boxGeometry args={[SHEET.width, SHEET.thickness, SHEET.depth]} />
        </mesh>
      ))}

      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={2} material={parts.materials.shadow}>
        <planeGeometry args={[1.5, 1.2]} />
      </mesh>
    </group>
  );
}
