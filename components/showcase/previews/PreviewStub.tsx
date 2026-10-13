'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type PreviewStubProps = {
  color: string;
  onReady?: () => void;
};

/**
 * Stand-in until the real scene is dropped in.
 * Disposes its geometry and material on unmount, and only advances while the tab is visible.
 */
export function PreviewStub({ color, onReady }: PreviewStubProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onReadyRef.current?.());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      const current = mesh.current;
      current?.geometry.dispose();
      const material = current?.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    };
  }, [invalidate]);

  useFrame((_, delta) => {
    if (document.visibilityState === 'hidden') return;
    if (mesh.current) mesh.current.rotation.y += delta * 0.7;
    invalidate();
  });

  return (
    <>
      <color attach="background" args={['#050505']} />
      <PerspectiveCamera makeDefault position={[0, 0.15, 3.1]} fov={38} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 3, 4]} intensity={2.2} />
      <mesh ref={mesh}>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </mesh>
    </>
  );
}
