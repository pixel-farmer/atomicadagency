'use client';

/**
 * Port of pmndrs "SSGI Spheres With Rapier Physics"
 * https://pmndrs.github.io/examples/ssgi-spheres-with-rapier-physics/
 */

import * as THREE from 'three';
import { type ReactNode, Suspense, useMemo, useReducer, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  BallCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { dampC } from 'maath/easing';
import { RapierBallpitEffects } from '@/components/experience/RapierBallpitEffects';

const accents = ['#F23E26', '#ffcc00', '#20ffa0', '#4060ff'];

const shuffle = (accent = 0) => [
  { color: '#f3f', roughness: 0.2, metalness: 0.1 },
  { color: '#f3f', roughness: 0.2, metalness: 0.1 },
  { color: '#f3f', roughness: 0.2, metalness: 0.1 },
  { color: '#20ffa0', roughness: 0.1, metalness: 0.1 },
  { color: '#20ffa0', roughness: 0.1, metalness: 0.1 },
  { color: '#20ffa0', roughness: 0.1, metalness: 0.1 },
  { color: '#4060ff', roughness: 0.1 },
  { color: '#4060ff', roughness: 0.3 },
  { color: '#4060ff', roughness: 0.3 },
  { color: '#4060ff', roughness: 0.1 },
  { color: '#F23E26', roughness: 0.2 },
  { color: '#F23E26', roughness: 0.1 },
  { color: '#F23E26', roughness: 0.3 },
  { color: '#F23E26', roughness: 0.3 },
];

type SphereProps = {
  position?: [number, number, number];
  children?: ReactNode;
  vec?: THREE.Vector3;
  scale?: number;
  r?: (range: number) => number;
  accent?: boolean;
  color?: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
};

function Sphere({
  position,
  children,
  vec = new THREE.Vector3(),
  r = THREE.MathUtils.randFloatSpread,
  color = 'white',
  ...props
}: SphereProps) {
  const api = useRef<RapierRigidBody>(null!);
  const ref = useRef<
    THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  >(null!);
  const pos = useMemo<[number, number, number]>(
    () => position ?? [r(10), r(10), r(10)],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match pmndrs demo: spawn once
    [],
  );

  useFrame((_state, delta) => {
    delta = Math.min(0.1, delta);
    api.current?.applyImpulse(
      vec.copy(api.current.translation()).negate().multiplyScalar(0.2),
      false,
    );
    if (ref.current) {
      dampC(ref.current.material.color, color, 0.2, delta);
    }
  });

  return (
    <RigidBody
      linearDamping={4}
      angularDamping={1}
      friction={0.1}
      position={pos}
      ref={api}
      colliders={false}
    >
      <BallCollider args={[1]} />
      <mesh ref={ref} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial {...props} color={color} />
        {children}
      </mesh>
    </RigidBody>
  );
}

function Pointer({ vec = new THREE.Vector3() }: { vec?: THREE.Vector3 }) {
  const ref = useRef<RapierRigidBody>(null!);
  useFrame(({ pointer, viewport }) =>
    ref.current?.setNextKinematicTranslation(
      vec.set(
        (pointer.x * viewport.width) / 2,
        (pointer.y * viewport.height) / 2,
        0,
      ),
    ),
  );
  return (
    <RigidBody
      position={[0, 0, 0]}
      type="kinematicPosition"
      colliders={false}
      ref={ref}
    >
      <BallCollider args={[1]} />
    </RigidBody>
  );
}

function BallpitScene({ accent }: { accent: number }) {
  const connectors = useMemo(() => shuffle(accent), [accent]);

  return (
    <>
      <color attach="background" args={['#141622']} />
      <Physics timeStep="vary" gravity={[0, 0, 0]}>
        <Pointer />
        {connectors.map((props, i) => (
          <Sphere key={i} {...props} />
        ))}
      </Physics>
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer
            form="circle"
            intensity={100}
            rotation-x={Math.PI / 2}
            position={[0, 5, -9]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, 1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, -1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={8}
          />
          <Lightformer
            form="ring"
            color="#4060ff"
            intensity={80}
            onUpdate={(self) => self.lookAt(0, 0, 0)}
            position={[10, 10, 0]}
            scale={10}
          />
        </group>
      </Environment>
      <RapierBallpitEffects />
    </>
  );
}

export function RapierBallpitCanvas() {
  const [accent, cycleAccent] = useReducer(
    (state: number) => (state + 1) % accents.length,
    0,
  );

  return (
    <Canvas
      flat
      shadows
      onClick={cycleAccent}
      dpr={[1, 1.5]}
      gl={{ antialias: false }}
      camera={{ position: [0, 0, 30], fov: 17.5, near: 10, far: 40 }}
      className="h-full w-full touch-none"
    >
      <Suspense fallback={null}>
        <BallpitScene accent={accent} />
      </Suspense>
    </Canvas>
  );
}
