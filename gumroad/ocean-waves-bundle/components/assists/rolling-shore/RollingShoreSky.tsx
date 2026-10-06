'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/** Simple gradient backdrop behind the horizon (reference: flat, muted purple-gray). */
export function RollingShoreSky() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color('#ffffff') },
        uHorizon: { value: new THREE.Color('#b7c0c4') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec3 vWorldPos;
        void main() {
          float t = smoothstep(-2.0, 42.0, vWorldPos.y);
          gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
        }
      `,
    });
  }, []);

  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[120, 32, 24]} />
    </mesh>
  );
}
