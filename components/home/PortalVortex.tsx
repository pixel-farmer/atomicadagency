'use client';

import { OrthographicCamera, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime;
uniform float uProgress;
uniform float uDistort;
uniform float uBump;
varying vec2 vUv;

// Swirl surface: two spiral arms, zero at the rim and at the exact center
float gelHeight(vec2 p) {
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float env = smoothstep(1.0, 0.3, r) * smoothstep(0.0, 0.15, r);
  float phase = a * 2.0 + r * 5.0 - uTime * 0.25;
  return sin(phase) * env;
}

void main() {
  vec2 p = vUv - 0.5;
  float e = 0.004;
  vec2 grad = vec2(
    gelHeight(p + vec2(e, 0.0)) - gelHeight(p - vec2(e, 0.0)),
    gelHeight(p + vec2(0.0, e)) - gelHeight(p - vec2(0.0, e))
  ) / (2.0 * e);

  vec3 col = texture2D(uTex, vUv + grad * uDistort * uProgress).rgb;

  // White highlight where the surface catches the light
  vec3 n = normalize(vec3(-grad * uBump * uProgress, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.7));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 80.0);
  col += vec3(1.0) * spec * 0.6 * uProgress;

  // A touch of shading so it has thickness
  col *= 1.0 + dot(grad, vec2(-0.5, 0.6)) * 0.004 * uProgress;

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
  onRest?: () => void;
};

export function PortalVortex({ src, active, onRest }: PortalVortexProps) {
  const texture = useTexture(src);
  const invalidate = useThree((state) => state.invalidate);
  const activeRef = useRef(active);
  const onRestRef = useRef(onRest);
  const resting = useRef(true);
  activeRef.current = active;
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
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uDistort: { value: 0.0015 },
        uBump: { value: 0.05 },
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

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const target = activeRef.current ? 1 : 0;
    const current = material.uniforms.uProgress.value as number;
    const next = THREE.MathUtils.damp(current, target, 8, delta);
    material.uniforms.uProgress.value = next;

    const visible = document.visibilityState === 'visible';
    if (visible) material.uniforms.uTime.value += delta;

    const changing = Math.abs(next - current) > 0.0008;
    if (visible && (changing || next > 0.001)) invalidate();

    if (!activeRef.current && next <= 0.001) {
      material.uniforms.uProgress.value = 0;
      if (!resting.current) {
        resting.current = true;
        onRestRef.current?.();
      }
    } else {
      resting.current = false;
    }
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
