'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BLACK_WATER_KOI_CONFIG } from '@/components/assists/black-water-koi/blackWaterKoiConfig';
import {
  blackWaterFragmentShader,
  blackWaterVertexShader,
  MAX_RIPPLES,
  MAX_TRAIL_RIPPLES,
  TRAIL_RIPPLE_LIFETIME,
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

type TrailRipple = Ripple & {
  /** Unit travel direction of the cursor when this ripple dropped. */
  dirX: number;
  dirZ: number;
  /** 0–1, from cursor speed — faster movement stretches the tail further. */
  stretch: number;
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

/** World-space distance the cursor travels between trail ripples. */
const TRAIL_SPACING = 0.65;
/** Caps how many ripples one fast flick can lay down in a single frame. */
const TRAIL_MAX_PER_FRAME = 3;
const TRAIL_STRENGTH = 0.05;
/** A jump larger than this (cursor left and re-entered elsewhere) restarts the trail. */
const TRAIL_RESET_DISTANCE = 4;
/** Cursor speed (world units / second) that gives the full tail stretch. */
const TRAIL_FULL_STRETCH_SPEED = 12;
/** Even a slow drift stretches the tail a little. */
const TRAIL_MIN_STRETCH = 0.2;

const WATER_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function BlackWaterSurface() {
  const ripplesRef = useRef<Ripple[]>([]);
  const nextRainAt = useRef(0);
  const bootstrapped = useRef(false);
  const trailRef = useRef<TrailRipple[]>([]);
  const lastPointer = useRef<THREE.Vector2 | null>(null);
  const lastTrailPoint = useRef<THREE.Vector3 | null>(null);
  const lastTrailTime = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

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
        uTrail: {
          value: Array.from({ length: MAX_TRAIL_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)),
        },
        uTrailMotion: {
          value: Array.from({ length: MAX_TRAIL_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)),
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

    if (BLACK_WATER_KOI_CONFIG.cursorRipplesEnabled) {
      // R3F only updates state.pointer on real pointer events, so an unchanged value means
      // the cursor is idle or off the canvas and no trail should be laid down.
      const prev = lastPointer.current;
      const moved = !prev || prev.x !== state.pointer.x || prev.y !== state.pointer.y;
      lastPointer.current = state.pointer.clone();

      if (prev && moved) {
        raycaster.setFromCamera(state.pointer, state.camera);
        if (raycaster.ray.intersectPlane(WATER_PLANE, hit)) {
          const from = lastTrailPoint.current;
          if (!from || from.distanceTo(hit) > TRAIL_RESET_DISTANCE) {
            lastTrailPoint.current = hit.clone();
            lastTrailTime.current = t;
          } else {
            const dist = from.distanceTo(hit);
            const steps = Math.min(TRAIL_MAX_PER_FRAME, Math.floor(dist / TRAIL_SPACING));
            if (steps > 0) {
              const elapsed = Math.max(t - lastTrailTime.current, 1 / 120);
              const stretch = THREE.MathUtils.clamp(
                dist / elapsed / TRAIL_FULL_STRETCH_SPEED,
                TRAIL_MIN_STRETCH,
                1,
              );
              const dirX = (hit.x - from.x) / dist;
              const dirZ = (hit.z - from.z) / dist;
              for (let s = 1; s <= steps; s++) {
                // When full, drop the oldest (most faded) ripple so the head of the wake
                // under the cursor is never missing.
                if (trailRef.current.length >= MAX_TRAIL_RIPPLES) trailRef.current.shift();
                const p = from.clone().lerp(hit, s / steps);
                trailRef.current.push({
                  x: p.x,
                  z: p.z,
                  startTime: t,
                  strength: TRAIL_STRENGTH * (0.85 + Math.random() * 0.3),
                  dirX,
                  dirZ,
                  stretch,
                });
              }
              lastTrailPoint.current = hit.clone();
              lastTrailTime.current = t;
            }
          }
        }
      }
    }

    trailRef.current = trailRef.current.filter((r) => t - r.startTime < TRAIL_RIPPLE_LIFETIME);

    const trailSlots = material.uniforms.uTrail.value as THREE.Vector4[];
    const motionSlots = material.uniforms.uTrailMotion.value as THREE.Vector4[];
    for (let i = 0; i < MAX_TRAIL_RIPPLES; i++) {
      const rip = trailRef.current[i];
      if (rip) {
        trailSlots[i].set(rip.x, rip.z, rip.startTime, rip.strength);
        motionSlots[i].set(rip.dirX, rip.dirZ, rip.stretch, 0);
      } else {
        trailSlots[i].set(0, 0, 0, 0);
        motionSlots[i].set(0, 0, 0, 0);
      }
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={2}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
    </mesh>
  );
}
