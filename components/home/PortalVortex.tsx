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
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uProgress;
uniform vec3 uTint;

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float r = length(centered);
  float angle = atan(centered.y, centered.x);
  vec2 sampleUv = vUv;

  // Progress 0 keeps the still image. Polar math is not bit-identical, so it stays off until the hover moves.
  if (uProgress > 0.0) {
    float core = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
    float swirled = angle + uProgress * (core * 7.0 + uTime * 0.7 * core);
    float zoom = mix(1.0, 0.45 + 0.55 * r, uProgress);
    float sampleR = r * zoom;
    vec2 warped = vec2(cos(swirled), sin(swirled)) * sampleR;
    sampleUv = warped * 0.5 + 0.5;
  }

  vec4 color = sRGBTransferEOTF(texture2D(uTex, sampleUv));
  float arm = 0.5 + 0.5 * sin(angle * 6.0 + r * 10.0 - uTime * 1.3);
  color.rgb *= mix(1.0, 0.72 + 0.28 * arm, uProgress);

  float centerShade = mix(0.22, 1.0, smoothstep(0.0, 0.78, r));
  color.rgb *= mix(1.0, centerShade, uProgress);

  float rim = smoothstep(0.68, 1.0, r) * uProgress;
  color.rgb += uTint * rim * 0.7;

  gl_FragColor = vec4(color.rgb, 1.0);
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
  tint: string;
  active: boolean;
  onRest?: () => void;
};

export function PortalVortex({ src, tint, active, onRest }: PortalVortexProps) {
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
        uTint: { value: new THREE.Color(tint) },
      },
      vertexShader,
      fragmentShader,
    });
  }, [texture, tint]);

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
