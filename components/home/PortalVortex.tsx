'use client';

import { OrthographicCamera, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const DURATION = 3.0;   // seconds for one wave to reach the rim
const INTERVAL = 0.8;        // calm pause between waves
const RINGS = Math.ceil(DURATION / INTERVAL) + 1;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform float uTime;   // seconds since hover began
uniform float uStop;   // time hover ended (1e9 while hovering, -1 when idle)
varying vec2 vUv;

const float MAX_RADIUS = 0.55;
const float SHADING = 8.0;
const float DURATION = ${DURATION.toFixed(3)};
const float INTERVAL = ${INTERVAL.toFixed(3)};
const int RINGS = ${RINGS};

float waveOffset(float t, vec2 dir) {
  float width = mix(0.04, 0.11, t);
  float d = length(dir) - t * MAX_RADIUS;
  d *= 1.0 - smoothstep(0.0, width, abs(d));
  d *= smoothstep(0.0, 0.05, t);
  d *= 1.0 - smoothstep(0.75, 1.0, t);
  return d;
}

// r, g, b offsets for one ring (the chromatic split)
vec3 ringOffsets(float t, vec2 dir) {
  float tOff = 0.05 * sin(t * 3.14159);
  return vec3(waveOffset(t + tOff, dir), waveOffset(t, dir), waveOffset(t - tOff, dir));
}

void main() {
  vec2 dir = uCenter - vUv;
  float len = length(dir);
  vec2 n = len > 1e-4 ? dir / len : vec2(0.0);

  vec3 sum = vec3(0.0);
  float newest = floor(uTime / INTERVAL);
  for (int i = 0; i < RINGS; i++) {
    float k = newest - float(i);
    float born = k * INTERVAL;
    if (k < 0.0 || born > uStop) continue;
    float t = (uTime - born) / DURATION;
    if (t < 0.0 || t > 1.0) continue;
    float amp = 1.0 - 0.65 * t;          // older rings are weaker
    sum += ringOffsets(t, dir) * amp;
  }
  sum *= 0.7;                            // keep overlaps from over-bending

  float r = texture2D(uTex, vUv + n * sum.r).r;
  float g = texture2D(uTex, vUv + n * sum.g).g;
  float b = texture2D(uTex, vUv + n * sum.b).b;

  vec3 col = vec3(r, g, b) + sum.g * SHADING;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

function FillFrame() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.left = -1;
    camera.right = 1;
    camera.top = 1;
    camera.bottom = -1;
    camera.near = 0.1;
    camera.far = 10;
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

type PortalVortexProps = {
  src: string;
  active: boolean;
  /** Ripple origin in uv space. Set when the wave starts. */
  origin?: [number, number];
  onRest?: () => void;
};

export function PortalVortex({ src, active, origin = [0.5, 0.5], onRest }: PortalVortexProps) {
  const texture = useTexture(src);
  const invalidate = useThree((state) => state.invalidate);
  const activeRef = useRef(active);
  const originRef = useRef(origin);
  const clock = useRef(0);
  const stopAt = useRef<number | null>(null);
  const running = useRef(false);
  const onRestRef = useRef(onRest);
  const wasActive = useRef(false);
  const playing = useRef(false);
  const rested = useRef(true);
  activeRef.current = active;
  originRef.current = origin;
  onRestRef.current = onRest;

  const material = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return new THREE.ShaderMaterial({
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTex: { value: texture },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uStop: { value: -1 },
      },
      vertexShader,
      fragmentShader,
    });
  }, [texture]);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [invalidate]);

  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const u = material.uniforms;
  
    if (activeRef.current && !running.current) {      // hover started
      running.current = true;
      clock.current = 0;
      stopAt.current = null;
      u.uStop.value = 1e9;
    }
    if (!running.current) return;
  
    if (activeRef.current && stopAt.current !== null) { // re-entered before settling
      stopAt.current = null;
      u.uStop.value = 1e9;
    }
  
    clock.current += delta;
    u.uTime.value = clock.current;
  
    if (!activeRef.current && stopAt.current === null) { // hover ended: stop making new rings
      stopAt.current = clock.current;
      u.uStop.value = clock.current;
    }
  
    if (stopAt.current !== null && clock.current > stopAt.current + DURATION) {
      running.current = false;                        // last ring has finished
      u.uTime.value = 0;
      u.uStop.value = -1;
      onRestRef.current?.();
      return;
    }
  
    if (document.visibilityState === 'visible') invalidate();
  });

  return (
    <>
      <OrthographicCamera
        makeDefault
        manual
        position={[0, 0, 1]}
        left={-1}
        right={1}
        top={1}
        bottom={-1}
        near={0.1}
        far={10}
      />
      <FillFrame />
      <mesh material={material} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
}
