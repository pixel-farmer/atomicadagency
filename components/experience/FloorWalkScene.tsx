'use client';

import { Clone, useGLTF, useTexture } from '@react-three/drei';
import { Suspense, useLayoutEffect, useMemo } from 'react';
import { Box3, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three';
import Rabbit from '@/components/rabbit';
import { SceneMouseOrbit } from '@/components/experience/SceneMouseOrbit';

const HORIZON_GREEN = '#2a5428';
const FLOOR_DIAMETER = 20;
const FLOOR_RADIUS = FLOOR_DIAMETER / 2;
const GRASS_TILE_METERS = 2.5;

/** Beside the rabbit on the grass (world XZ). */
const POPPY_POSITION: [number, number, number] = [1.15, 0, 0.15];
const POPPY_TARGET_HEIGHT = 2.2;

useTexture.preload('/grass1024x1024.png');
useGLTF.preload('/flower-poppy.glb');

function FlowerPoppy() {
  const { scene } = useGLTF('/flower-poppy.glb');

  const { scale, floorY } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    const scale = POPPY_TARGET_HEIGHT / Math.max(size.y, 0.001);
    const floorY = -box.min.y * scale;
    return { scale, floorY };
  }, [scene]);

  return (
    <group
      position={[POPPY_POSITION[0], floorY, POPPY_POSITION[2]]}
      scale={scale}
    >
      <Clone object={scene} deep castShadow receiveShadow />
    </group>
  );
}

function GrassFloor() {
  const grassMap = useTexture('/grass1024x1024.png');

  useLayoutEffect(() => {
    grassMap.wrapS = RepeatWrapping;
    grassMap.wrapT = RepeatWrapping;
    grassMap.repeat.set(
      FLOOR_DIAMETER / GRASS_TILE_METERS,
      FLOOR_DIAMETER / GRASS_TILE_METERS,
    );
    grassMap.colorSpace = SRGBColorSpace;
    grassMap.anisotropy = 8;
    grassMap.needsUpdate = true;
  }, [grassMap]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[FLOOR_RADIUS, 64]} />
      <meshStandardMaterial
        map={grassMap}
        color="#ffffff"
        roughness={2.00}
        metalness={0.04}
        envMapIntensity={0.15}
      />
    </mesh>
  );
}

export function FloorWalkScene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 28, 88]} />

      <ambientLight intensity={0.3} />
      <hemisphereLight
        color="#b8c9e8"
        groundColor={HORIZON_GREEN}
        intensity={3.65}
        position={[0, 40, 0]}
      />
      <directionalLight position={[12, 24, 8]} intensity={0.85} castShadow />

      <Suspense fallback={null}>
        <GrassFloor />
        <Rabbit />
        <FlowerPoppy />
      </Suspense>

      <SceneMouseOrbit center={[0, 0.75, 0]} radius={4} eyeHeight={1.65} />
    </>
  );
}

export { FLOOR_DIAMETER, FLOOR_RADIUS };
