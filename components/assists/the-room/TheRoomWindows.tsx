'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

const FRAME_PATH = '/arched-window.glb';
const FRAME_COLOR = '#f3f0ea';
const GLASS_TINT = '#b8d4ec';

/** Clear space below each window (meters). The 8 m frame then leaves about 2 m above it too. */
const WINDOW_MARGIN = 2;
/** Two centers along Z on the +X (right) wall. */
const WINDOW_Z = [-4.1, 4.1] as const;

/**
 * Measured from arched-window.glb (meters, standing on y = 0, centered on x = 0): a semicircular
 * arch springing at y = 5.95 from a 4.26 m wide frame, 0.26 m deep. The glass is cut a little
 * smaller than the outer edge so the frame hides its border.
 */
const GLASS_HALF_WIDTH = 2.06;
const ARCH_SPRING_Y = 5.95;
const GLASS_BOTTOM_Y = 0.02;
const FRAME_HALF_DEPTH = 0.129;
const FRAME_BOTTOM_Y = -0.041;
const FRAME_HEIGHT = 8.117;

useGLTF.preload(FRAME_PATH);

function useWindowMaterials() {
  const materials = useMemo(() => {
    const frame = new THREE.MeshStandardMaterial({
      color: FRAME_COLOR,
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: GLASS_TINT,
      roughness: 0.18,
      metalness: 0,
      specularIntensity: 0.35,
      transparent: true,
      opacity: 0.92,
      transmission: 0.88,
      thickness: 0.015,
      ior: 1.45,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    const sky = new THREE.MeshBasicMaterial({
      color: '#8eb9d9',
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return { frame, glass, sky };
  }, []);

  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials],
  );

  return materials;
}

function archedOutline(halfWidth: number, springY: number, bottomY: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, bottomY);
  shape.lineTo(halfWidth, bottomY);
  shape.lineTo(halfWidth, springY);
  shape.absarc(0, springY, halfWidth, 0, Math.PI, false);
  shape.lineTo(-halfWidth, bottomY);
  return new THREE.ShapeGeometry(shape, 48);
}

function ArchedWindow({ materials }: { materials: ReturnType<typeof useWindowMaterials> }) {
  const { scene } = useGLTF(FRAME_PATH);

  // Some of the model's bars have no material of their own, so every part gets the frame finish.
  const frame = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).material = materials.frame;
    });
    return clone;
  }, [scene, materials.frame]);

  const outline = useMemo(
    () => archedOutline(GLASS_HALF_WIDTH, ARCH_SPRING_Y, GLASS_BOTTOM_Y),
    [],
  );
  useEffect(() => () => outline.dispose(), [outline]);

  // Local +Z points into the room (world -X), so the sky sits at the back against the wall.
  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={outline} position={[0, 0, -FRAME_HALF_DEPTH + 0.004]} material={materials.sky} />
      <mesh geometry={outline} position={[0, 0, -0.02]} material={materials.glass} />
      <primitive object={frame} />
    </group>
  );
}

export function TheRoomRightWallWindows({ roomWidth }: { roomWidth: number }) {
  const materials = useWindowMaterials();
  const wallX = roomWidth / 2 - FRAME_HALF_DEPTH - 0.005;
  const baseY = WINDOW_MARGIN - FRAME_BOTTOM_Y;
  const centerY = WINDOW_MARGIN + FRAME_HEIGHT / 2;

  return (
    <>
      {WINDOW_Z.map((z) => (
        <group key={z} position={[wallX, baseY, z]}>
          <ArchedWindow materials={materials} />
        </group>
      ))}
      {WINDOW_Z.map((z) => (
        <pointLight
          key={`light-${z}`}
          position={[wallX - 1.2, centerY, z]}
          intensity={3.5}
          distance={12}
          decay={2}
          color="#e8f2ff"
        />
      ))}
    </>
  );
}
