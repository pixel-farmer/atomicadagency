'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { roomSun } from '@/components/assists/the-room/TheRoomSunlight';
import {
  ARCH_SPRING_Y,
  GLASS_BOTTOM_Y,
  GLASS_HALF_WIDTH,
  WINDOW_BASE_Y,
  WINDOW_Z,
  windowWallX,
} from '@/components/assists/the-room/TheRoomWindows';

/* ---------------------------------- dust ---------------------------------- */

/** Number of floating specks. Most are invisible until they drift into a sunbeam. */
const DUST_COUNT = 100;
/** Speck size. Larger reads as pollen, smaller as fine dust. */
const DUST_SIZE = 0.022;
/** Brightness of a speck inside the sunbeam. */
const DUST_BEAM_BRIGHTNESS = 1.6;
/** Brightness of a speck outside the beam. 0 hides them completely. */
const DUST_AMBIENT_BRIGHTNESS = 0.05;
/** How far each speck wanders from its spot, in meters. */
const DUST_DRIFT = 0.55;
/** Drift speed. 1 is a slow float. */
const DUST_SPEED = 1;
const DUST_COLOR = '#fff1d6';

const dustVertexShader = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uSize;
uniform float uDrift;
uniform vec3 uSunDir;
uniform float uWallX;
uniform vec2 uWinZ;
uniform float uBase;
uniform float uSpring;
uniform float uHalf;
uniform float uBottom;
attribute vec4 aSeed;
varying float vBeam;
varying float vTwinkle;
varying float vNear;

// 1 when sunlight arriving along uSunDir has passed through one of the arched windows.
float sunlit(vec3 p) {
  float s = (p.x - uWallX) / uSunDir.x;
  vec3 hit = p - s * uSunDir;
  float lit = 0.0;
  for (int i = 0; i < 2; i++) {
    float dz = hit.z - uWinZ[i];
    float y = hit.y - uBase;
    float d = y < uSpring ? uHalf - abs(dz) : uHalf - length(vec2(dz, y - uSpring));
    d = min(d, y - uBottom);
    lit = max(lit, smoothstep(0.0, 0.3, d));
  }
  return lit * step(0.0, s);
}

void main() {
  vec3 p = position + uDrift * vec3(
    sin(uTime * 0.11 + aSeed.x * 40.0),
    sin(uTime * 0.08 + aSeed.y * 40.0) * 0.7,
    cos(uTime * 0.1 + aSeed.z * 40.0)
  );

  vBeam = sunlit(p);
  vTwinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed.w) + aSeed.x * 60.0);

  vec4 mv = viewMatrix * vec4(p, 1.0);
  vNear = smoothstep(0.4, 1.8, -mv.z);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.55 + aSeed.w) * uScale / max(-mv.z, 0.1);
}
`;

const dustFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uBeamBrightness;
uniform float uAmbient;
uniform float uCloud;
varying float vBeam;
varying float vTwinkle;
varying float vNear;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = 1.0 - smoothstep(0.0, 0.5, d);
  core *= core;
  float light = uAmbient + vBeam * uBeamBrightness * uCloud;
  float a = core * light * vTwinkle * vNear;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

type AtmosphereProps = {
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
};

/** Specks of dust hanging in the air. They only show where the window light passes through them. */
export function TheRoomAtmosphere({ roomWidth, roomDepth, roomHeight }: AtmosphereProps) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const seeds = new Float32Array(DUST_COUNT * 4);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (roomWidth - 0.6);
      positions[i * 3 + 1] = 0.3 + Math.random() * (roomHeight - 0.8);
      positions[i * 3 + 2] = (Math.random() - 0.5) * (roomDepth - 0.6);
      for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [roomWidth, roomDepth, roomHeight]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1 },
          uSize: { value: DUST_SIZE },
          uDrift: { value: DUST_DRIFT },
          uSunDir: { value: new THREE.Vector3(-1, -0.8, -0.3).normalize() },
          uWallX: { value: windowWallX(roomWidth) },
          uWinZ: { value: new THREE.Vector2(WINDOW_Z[0], WINDOW_Z[1]) },
          uBase: { value: WINDOW_BASE_Y },
          uSpring: { value: ARCH_SPRING_Y },
          uHalf: { value: GLASS_HALF_WIDTH },
          uBottom: { value: GLASS_BOTTOM_Y },
          uColor: { value: new THREE.Color(DUST_COLOR) },
          uBeamBrightness: { value: DUST_BEAM_BRIGHTNESS },
          uAmbient: { value: DUST_AMBIENT_BRIGHTNESS },
          uCloud: { value: 1 },
        },
      }),
    [roomWidth],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime * DUST_SPEED;
    // Point sizes are in pixels, so scale them by the drawing-buffer height.
    u.uScale.value = size.height * dpr * 0.5;
    (u.uSunDir.value as THREE.Vector3).copy(roomSun.direction);
    u.uCloud.value = roomSun.cloud;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}

/* ---------------------------------- grade --------------------------------- */

/** Glow around anything brighter than this. The windows and sunlit floor are what catch it. */
const BLOOM_THRESHOLD = 0.82;
/** Strength of the glow. 0 turns bloom off. */
const BLOOM_STRENGTH = 0.55;
/** Size of the glow. Higher is wider and softer. */
const BLOOM_RADIUS = 0.75;
/** Edge darkening. 0 turns it off. */
const VIGNETTE_STRENGTH = 0.5;
/** Film grain opacity. 0 turns it off. */
const GRAIN_OPACITY = 0.045;
/** Color fringing toward the screen edges. 0 turns it off. */
const CHROMATIC_ABERRATION = 0.0006;

/** Bloom, a little lens fringing, film tone mapping, a soft vignette and grain over the whole scene. */
export function TheRoomGrade() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const effect = new EffectComposer(gl, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
    effect.addPass(new RenderPass(scene, camera));
    effect.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          intensity: BLOOM_STRENGTH,
          luminanceThreshold: BLOOM_THRESHOLD,
          luminanceSmoothing: 0.35,
          mipmapBlur: true,
          radius: BLOOM_RADIUS,
        }),
      ),
    );
    const fringe = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(CHROMATIC_ABERRATION, CHROMATIC_ABERRATION * 0.6),
      radialModulation: true,
      modulationOffset: 0.25,
    });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = GRAIN_OPACITY;
    // Everything after bloom shares one pass, so the frame is read and written once, not four times.
    effect.addPass(
      new EffectPass(
        camera,
        fringe,
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        new VignetteEffect({ darkness: VIGNETTE_STRENGTH, offset: 0.3 }),
        grain,
      ),
    );
    return effect;
  }, [gl, scene, camera]);

  // The composer applies tone mapping itself, so the renderer must not apply it a second time.
  useLayoutEffect(() => {
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}
