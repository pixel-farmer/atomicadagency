'use client';

import { Clone, MeshReflectorMaterial, useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import { ArcadeOrbitControls } from '@/components/experience/ArcadeOrbitControls';

const ARCADE_TARGET_SIZE = 10;
const PLATFORM_DIAMETER = 24;
const PLATFORM_RADIUS = PLATFORM_DIAMETER / 2;

useGLTF.preload('/the-arcade.glb');

function ArcadePlatform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[PLATFORM_RADIUS, 64]} />
      <MeshReflectorMaterial
        color="#666666"
        roughness={0.2}
        metalness={0.2}
        mirror={0.8}
        mixStrength={0.8}
        mixBlur={0.25}
        blur={[400, 120]}
        resolution={768}
        depthScale={1.1}
        minDepthThreshold={0.25}
        maxDepthThreshold={1.2}
        reflectorOffset={0.02}
      />
    </mesh>
  );
}

function TheArcadeModel() {
  const { scene } = useGLTF('/the-arcade.glb');

  const { scale, position } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = ARCADE_TARGET_SIZE / maxDim;
    return {
      scale,
      position: [
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      ] as [number, number, number],
    };
  }, [scene]);

  return (
    <group position={position} scale={scale}>
      <Clone object={scene} deep castShadow receiveShadow />
    </group>
  );
}

export function ArcadeScene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 16, 10]} intensity={1.1} castShadow />
      <directionalLight position={[-6, 8, -4]} intensity={0.35} />

      <Suspense fallback={null}>
        <TheArcadeModel />
        <ArcadePlatform />
      </Suspense>

      <ArcadeOrbitControls />
    </>
  );
}
