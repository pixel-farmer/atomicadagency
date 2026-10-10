'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

const FRAME_COLOR = '#f3f0ea';
const MULLION_COLOR = '#ebe6de';
const GLASS_TINT = '#b8d4ec';

const WINDOW_WIDTH = 2.75;
/** Clear space above and below each window (meters). */
const WINDOW_MARGIN = 2;
/** Height of the arch from the spring line to the crown. */
const ARCH_RISE = 0.95;
const FRAME = 0.09;
const MULLION = 0.045;
const CASING_DEPTH = 0.07;

/** Two centers along Z on the +X (right) wall. */
const WINDOW_Z = [-4.1, 4.1] as const;

function archRadius(chord: number, rise: number) {
  return (chord * chord) / (8 * rise) + rise / 2;
}

/** Traces a segmental arch from the left spring point over the crown to the right spring point. */
function traceArch(path: THREE.Path, chord: number, rise: number, springY: number) {
  const half = chord / 2;
  const R = archRadius(chord, rise);
  const cy = springY + rise - R;
  const start = Math.atan2(springY - cy, -half);
  const end = Math.atan2(springY - cy, half);
  path.moveTo(-half, springY);
  path.absarc(0, cy, R, start, end, true);
}

function useWindowMaterials() {
  return useMemo(() => {
    const frame = new THREE.MeshStandardMaterial({
      color: FRAME_COLOR,
      roughness: 0.82,
      metalness: 0.02,
    });
    const mullion = new THREE.MeshStandardMaterial({
      color: MULLION_COLOR,
      roughness: 0.78,
      metalness: 0.02,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: GLASS_TINT,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
      transmission: 0.88,
      thickness: 0.015,
      ior: 1.45,
      envMapIntensity: 0.6,
    });
    glass.side = THREE.DoubleSide;
    const sky = new THREE.MeshBasicMaterial({
      color: '#8eb9d9',
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return { frame, mullion, glass, sky };
  }, []);
}

type PaneGrid = { cols: number; rows: number };

function CasementLeaf({
  width,
  height,
  grid,
  materials,
  xOffset,
  centerY,
}: {
  width: number;
  height: number;
  grid: PaneGrid;
  materials: ReturnType<typeof useWindowMaterials>;
  xOffset: number;
  centerY: number;
}) {
  const innerW = width - FRAME;
  const innerH = height - FRAME;
  const paneW = (innerW - MULLION * (grid.cols - 1)) / grid.cols;
  const paneH = (innerH - MULLION * (grid.rows - 1)) / grid.rows;
  const baseY = centerY - height / 2;

  const panes: { x: number; y: number }[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x =
        xOffset + -width / 2 + FRAME + col * (paneW + MULLION) + paneW / 2;
      const y = baseY + FRAME + row * (paneH + MULLION) + paneH / 2;
      panes.push({ x, y });
    }
  }

  return (
    <group>
      {panes.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, CASING_DEPTH * 0.15]} material={materials.glass}>
          <planeGeometry args={[paneW * 0.96, paneH * 0.96]} />
        </mesh>
      ))}
      {Array.from({ length: grid.cols - 1 }, (_, i) => {
        const x =
          xOffset +
          -width / 2 +
          FRAME +
          (i + 1) * paneW +
          i * MULLION +
          MULLION / 2;
        return (
          <mesh
            key={`v-${i}`}
            position={[x, centerY, CASING_DEPTH * 0.22]}
            material={materials.mullion}
          >
            <boxGeometry args={[MULLION * 0.85, innerH, CASING_DEPTH * 0.35]} />
          </mesh>
        );
      })}
      {Array.from({ length: grid.rows - 1 }, (_, i) => {
        const y = baseY + FRAME + (i + 1) * paneH + i * MULLION + MULLION / 2;
        return (
          <mesh key={`h-${i}`} position={[xOffset, y, CASING_DEPTH * 0.22]} material={materials.mullion}>
            <boxGeometry args={[innerW, MULLION * 0.85, CASING_DEPTH * 0.35]} />
          </mesh>
        );
      })}
    </group>
  );
}

function ArchedFanlight({
  innerW,
  springY,
  materials,
}: {
  innerW: number;
  springY: number;
  materials: ReturnType<typeof useWindowMaterials>;
}) {
  const innerRise = Math.max(ARCH_RISE - FRAME, 0.12);
  const innerHalf = innerW / 2;

  const { glassGeo, frameGeo } = useMemo(() => {
    const outer = new THREE.Shape();
    traceArch(outer, WINDOW_WIDTH, ARCH_RISE, springY);
    outer.lineTo(-WINDOW_WIDTH / 2, springY);

    const hole = new THREE.Path();
    traceArch(hole, innerW, innerRise, springY);
    hole.lineTo(-innerW / 2, springY);
    outer.holes.push(hole);

    const frameGeo = new THREE.ExtrudeGeometry(outer, {
      depth: CASING_DEPTH,
      bevelEnabled: false,
      curveSegments: 32,
    });

    const glassShape = new THREE.Shape();
    traceArch(glassShape, innerW, innerRise, springY);
    glassShape.lineTo(-innerW / 2, springY);
    const glassGeo = new THREE.ShapeGeometry(glassShape, 32);

    return { glassGeo, frameGeo };
  }, [innerW, innerRise, springY]);

  return (
    <group>
      <mesh geometry={frameGeo} material={materials.frame} />
      <mesh
        geometry={glassGeo}
        position={[0, 0, CASING_DEPTH * 0.15]}
        material={materials.glass}
      />
      <mesh position={[0, springY + innerRise * 0.55, CASING_DEPTH * 0.22]} material={materials.mullion}>
        <boxGeometry args={[MULLION * 0.85, innerRise * 0.95, CASING_DEPTH * 0.35]} />
      </mesh>
      {[-0.38, 0.38].map((side) => (
        <mesh
          key={side}
          position={[
            side * innerHalf * 0.55,
            springY + innerRise * 0.35,
            CASING_DEPTH * 0.22,
          ]}
          rotation={[0, 0, side * 0.62]}
          material={materials.mullion}
        >
          <boxGeometry args={[MULLION * 0.75, innerRise * 0.75, CASING_DEPTH * 0.32]} />
        </mesh>
      ))}
    </group>
  );
}

function FrenchCasementWindow({
  materials,
  windowHeight,
}: {
  materials: ReturnType<typeof useWindowMaterials>;
  windowHeight: number;
}) {
  const halfInner = (WINDOW_WIDTH - FRAME * 2 - MULLION) / 2;
  const leafW = halfInner + FRAME;
  const innerW = WINDOW_WIDTH - FRAME * 2;
  const springY = windowHeight / 2 - ARCH_RISE - FRAME * 0.5;
  const rectH = springY - (-windowHeight / 2 + FRAME);
  const rectCenterY = (-windowHeight / 2 + FRAME + springY) / 2;
  const jambH = windowHeight - ARCH_RISE - FRAME;
  const jambY = -windowHeight / 2 + jambH / 2;

  const skyShape = useMemo(() => {
    const half = WINDOW_WIDTH / 2;
    const shape = new THREE.Shape();
    traceArch(shape, WINDOW_WIDTH, ARCH_RISE, springY);
    shape.lineTo(half, -windowHeight / 2);
    shape.lineTo(-half, -windowHeight / 2);
    shape.lineTo(-half, springY);
    return new THREE.ShapeGeometry(shape, 32);
  }, [windowHeight, springY]);

  // Local +Z must point into the room (world -X) so the glass and sky planes face the viewer.
  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={skyShape} position={[0, 0, -CASING_DEPTH * 0.55]} material={materials.sky} />

      <mesh position={[0, -windowHeight / 2 + FRAME / 2, CASING_DEPTH * 0.2]} material={materials.frame}>
        <boxGeometry args={[WINDOW_WIDTH, FRAME, CASING_DEPTH]} />
      </mesh>
      <mesh position={[-WINDOW_WIDTH / 2 + FRAME / 2, jambY, CASING_DEPTH * 0.2]} material={materials.frame}>
        <boxGeometry args={[FRAME, jambH, CASING_DEPTH]} />
      </mesh>
      <mesh position={[WINDOW_WIDTH / 2 - FRAME / 2, jambY, CASING_DEPTH * 0.2]} material={materials.frame}>
        <boxGeometry args={[FRAME, jambH, CASING_DEPTH]} />
      </mesh>

      <ArchedFanlight innerW={innerW} springY={springY} materials={materials} />

      <mesh position={[0, rectCenterY, CASING_DEPTH * 0.25]} material={materials.mullion}>
        <boxGeometry args={[MULLION, rectH - FRAME, CASING_DEPTH * 0.45]} />
      </mesh>

      <CasementLeaf
        width={leafW}
        height={rectH}
        grid={{ cols: 2, rows: 4 }}
        materials={materials}
        xOffset={-leafW / 2 - MULLION / 2}
        centerY={rectCenterY}
      />
      <CasementLeaf
        width={leafW}
        height={rectH}
        grid={{ cols: 2, rows: 4 }}
        materials={materials}
        xOffset={leafW / 2 + MULLION / 2}
        centerY={rectCenterY}
      />

      <mesh position={[0, springY - FRAME * 0.15, CASING_DEPTH * 0.24]} material={materials.mullion}>
        <boxGeometry args={[innerW, MULLION * 0.9, CASING_DEPTH * 0.38]} />
      </mesh>

      <mesh position={[0, -windowHeight / 2 - 0.025, CASING_DEPTH * 0.35]} material={materials.frame}>
        <boxGeometry args={[WINDOW_WIDTH + 0.12, 0.05, CASING_DEPTH * 1.1]} />
      </mesh>
    </group>
  );
}

export function TheRoomRightWallWindows({
  roomWidth,
  roomHeight,
}: {
  roomWidth: number;
  roomHeight: number;
}) {
  const materials = useWindowMaterials();
  const windowHeight = roomHeight - WINDOW_MARGIN * 2;
  const windowCenterY = WINDOW_MARGIN + windowHeight / 2;
  const wallX = roomWidth / 2 - CASING_DEPTH / 2 - 0.01;

  return (
    <>
      {WINDOW_Z.map((z) => (
        <group key={z} position={[wallX, windowCenterY, z]}>
          <FrenchCasementWindow materials={materials} windowHeight={windowHeight} />
        </group>
      ))}
      {WINDOW_Z.map((z) => (
        <pointLight
          key={`light-${z}`}
          position={[wallX - 1.2, windowCenterY, z]}
          intensity={3.5}
          distance={12}
          decay={2}
          color="#e8f2ff"
        />
      ))}
    </>
  );
}
