'use client';

import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SRGBColorSpace } from 'three';
import {
  rollingShoreFragmentShader,
  rollingShoreVertexShader,
} from '@/components/assists/rolling-shore/shaders/rollingShoreShader';

/** World units — beach near negative Z, open ocean toward +Z. */
const PLANE_WIDTH = 82;
const PLANE_DEPTH = 56;
const PLANE_CENTER_Z = 20;
const SEGMENTS = 128;

/** World-space repeats per unit (seamless sand03 tile). */
const SAND_REPEAT: [number, number] = [0.2, 0.2];

const SAND_TEXTURE_PATH = '/sand03-seamless.png';

export function RollingShoreSurface() {
  const sandMap = useTexture(SAND_TEXTURE_PATH);

  const material = useMemo(() => {
    sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
    sandMap.colorSpace = SRGBColorSpace;
    sandMap.anisotropy = 8;

    return new THREE.ShaderMaterial({
      vertexShader: rollingShoreVertexShader,
      fragmentShader: rollingShoreFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSkyTop: { value: new THREE.Color('#c5c8ca') },
        uSkyHorizon: { value: new THREE.Color('#c5c8ca') },
        uSandMap: { value: sandMap },
        uSandRepeat: { value: new THREE.Vector2(...SAND_REPEAT) },
      },
    });
  }, [sandMap]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, PLANE_CENTER_Z]}
      material={material}
    >
      <planeGeometry args={[PLANE_WIDTH, PLANE_DEPTH, SEGMENTS, SEGMENTS]} />
    </mesh>
  );
}
