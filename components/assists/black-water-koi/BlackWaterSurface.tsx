'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  blackWaterFragmentShader,
  blackWaterVertexShader,
  MAX_RIPPLES,
} from '@/components/assists/black-water-koi/shaders/blackWaterShader';

/** Large enough that plane edges stay outside the frustum on ultrawide viewports. */
export const PLANE_SIZE = 56;
const PLANE_SEGMENTS = 1;

type Ripple = {
  x: number;
  z: number;
  startTime: number;
  strength: number;
};

/** Visible swim area — rain stays here even though the mesh is larger for edge fade. */
const RAIN_SPREAD = 7.2;

function spawnRipple(ripples: Ripple[], t: number) {
  const spread = RAIN_SPREAD;
  ripples.push({
    x: (Math.random() - 0.5) * spread * 2,
    z: (Math.random() - 0.5) * spread * 2,
    startTime: t,
    strength: 0.14 + Math.random() * 0.08,
  });
}

export function BlackWaterSurface() {
  const ripplesRef = useRef<Ripple[]>([]);
  const nextRainAt = useRef(0);
  const bootstrapped = useRef(false);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: blackWaterVertexShader,
      fragmentShader: blackWaterFragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uRipples: {
          value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)),
        },
        uLightDir: {
          value: new THREE.Vector3(-4, 9, 3).normalize(),
        },
      },
    });
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    material.uniforms.uTime.value = t;

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      spawnRipple(ripplesRef.current, t);
      spawnRipple(ripplesRef.current, t);
      nextRainAt.current = t + 0.18;
    }

    const living = ripplesRef.current.filter((r) => t - r.startTime < 5.0);
    const maxLiving = 9;
    if (t >= nextRainAt.current && living.length < maxLiving) {
      nextRainAt.current = t + 0.2 + Math.random() * 0.55;
      spawnRipple(ripplesRef.current, t);
      if (Math.random() < 0.28 && living.length + 1 < maxLiving) {
        spawnRipple(ripplesRef.current, t);
      }
    }

    ripplesRef.current = ripplesRef.current
      .filter((r) => t - r.startTime < 5.0)
      .slice(-MAX_RIPPLES);

    const slots = material.uniforms.uRipples.value as THREE.Vector4[];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const rip = ripplesRef.current[i];
      if (rip) {
        slots[i].set(rip.x, rip.z, rip.startTime, rip.strength);
      } else {
        slots[i].set(0, 0, 0, 0);
      }
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={2}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
    </mesh>
  );
}
