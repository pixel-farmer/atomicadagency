'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  ARCH_SPRING_Y,
  GLASS_BOTTOM_Y,
  GLASS_HALF_WIDTH,
  traceArchedOpening,
  WINDOW_BASE_Y,
  WINDOW_Z,
  windowWallX,
} from '@/components/assists/the-room/TheRoomWindows';

/** Direction the sunlight travels: in through the right wall (-X), down, and a little toward the back. */
const SUN_DIRECTION = new THREE.Vector3(-1, -0.8, -0.3).normalize();
const SUN_COLOR = '#fff1d6';
const SUN_INTENSITY = 4.4;

/** Slow sun drift, passing clouds and warm/cool shift. 1 is gentle, 0 freezes the light. */
const SUN_DRIFT = 0;

/** Softness of the shadow edges, in shadow-map texels. 1 is nearly sharp, 8 is soft, 15 is very blurry. */
const SHADOW_BLUR = 3;
/** Samples used for the blur. More is smoother and costs more. 8 to 25 is a sensible range. */
const SHADOW_BLUR_SAMPLES = 6;
const SUN_COLOR_COOL = new THREE.Color('#fff6ea');
const SUN_COLOR_WARM = new THREE.Color('#ffd49a');

/** Live sun state, updated every frame. The dust reads it to know which air is in sunlight. */
export const roomSun = { direction: SUN_DIRECTION.clone(), cloud: 1 };

/** The shafts of light you can see in the air (same streak idea as reactbits/lightrays). */
const BEAM_COLOR = '#fff3dc';
const BEAM_INTENSITY = 0.24;
/** How far into the room (meters, horizontally) the shafts reach before fading out. */
const BEAM_LENGTH = 14;
const BEAM_SPEED = 1;

const beamVertexShader = /* glsl */ `
uniform vec2 uShear;

varying vec2 vCross;
varying float vAlong;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  // The beam is the window outline extruded straight into the room, then sheared along the sun.
  vCross = position.xy;
  vAlong = position.z;
  vec3 p = position;
  p.xy += p.z * uShear;
  vec3 n = vec3(normal.xy, normal.z - dot(normal.xy, uShear));

  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const beamFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uLength;

varying vec2 vCross;
varying float vAlong;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  // Surfaces seen edge-on fade away, so the shaft has soft sides instead of hard outlines.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float soft = pow(abs(dot(normalize(vWorldNormal), viewDir)), 1.5);

  // Two drifting streak patterns across the opening, as in lightrays.tsx.
  float u = vCross.x * 1.1 + vCross.y * 0.35;
  float streak = clamp(
    (0.45 + 0.15 * sin(u * 3.6 + uTime * 0.35 * uSpeed)) +
    (0.3 + 0.2 * cos(-u * 2.1 + uTime * 0.22 * uSpeed)),
    0.0, 1.0
  );

  float fromWindow = smoothstep(0.0, 0.8, vAlong);
  float lengthFade = 1.0 - smoothstep(0.0, uLength, vAlong);
  float floorFade = smoothstep(0.0, 1.8, vWorldPos.y);
  float a = streak * soft * fromWindow * lengthFade * floorFade * uIntensity;
  // The scene is graded after drawing, so write linear values that look the same once encoded.
  gl_FragColor = vec4(pow(uColor * a, vec3(2.2)), 1.0);
}
`;

function useBeamGeometry() {
  const geometry = useMemo(() => {
    const shape = traceArchedOpening(
      new THREE.Shape(),
      0,
      GLASS_HALF_WIDTH,
      ARCH_SPRING_Y,
      GLASS_BOTTOM_Y,
    );
    return new THREE.ExtrudeGeometry(shape, {
      depth: BEAM_LENGTH,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 24,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function useBeamMaterial() {
  const material = useMemo(() => {
    // Window groups face into the room with rotation -PI/2 about Y: local +Z = world -X, local +X = world +Z.
    const local = new THREE.Vector3(SUN_DIRECTION.z, SUN_DIRECTION.y, -SUN_DIRECTION.x);
    return new THREE.ShaderMaterial({
        vertexShader: beamVertexShader,
        fragmentShader: beamFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uShear: { value: new THREE.Vector2(local.x / local.z, local.y / local.z) },
          uTime: { value: 0 },
          uSpeed: { value: BEAM_SPEED },
          uColor: { value: new THREE.Color(BEAM_COLOR) },
          uIntensity: { value: BEAM_INTENSITY },
          uLength: { value: BEAM_LENGTH },
        },
      });
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });
  return material;
}

/**
 * The room's visible walls don't cast shadows (the right wall would block the windows), so these
 * invisible stand-ins do: the right wall with the window openings cut out, plus the ceiling and
 * front wall so sunlight can't leak in over or beside the room.
 */
function SunShadowCasters({
  roomWidth,
  roomDepth,
  roomHeight,
}: {
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
}) {
  const { wall, slab, material } = useMemo(() => {
    const pad = 4;
    const outer = new THREE.Shape();
    outer.moveTo(-roomDepth / 2 - pad, -pad);
    outer.lineTo(roomDepth / 2 + pad, -pad);
    outer.lineTo(roomDepth / 2 + pad, roomHeight + pad);
    outer.lineTo(-roomDepth / 2 - pad, roomHeight + pad);
    outer.lineTo(-roomDepth / 2 - pad, -pad);
    for (const z of WINDOW_Z) {
      outer.holes.push(
        traceArchedOpening(
          new THREE.Path(),
          z,
          GLASS_HALF_WIDTH,
          WINDOW_BASE_Y + ARCH_SPRING_Y,
          WINDOW_BASE_Y + GLASS_BOTTOM_Y,
        ),
      );
    }
    const material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return {
      wall: new THREE.ShapeGeometry(outer, 48),
      slab: new THREE.PlaneGeometry(roomWidth + 2 * pad, roomDepth + 2 * pad),
      material,
    };
  }, [roomWidth, roomDepth, roomHeight]);

  useEffect(
    () => () => {
      wall.dispose();
      slab.dispose();
      material.dispose();
    },
    [wall, slab, material],
  );

  const gap = 0.05;
  return (
    <>
      <mesh
        geometry={wall}
        material={material}
        position={[roomWidth / 2 + gap, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
      <mesh
        geometry={slab}
        material={material}
        position={[0, roomHeight + gap, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
      <mesh
        geometry={slab}
        material={material}
        position={[0, roomHeight / 2, roomDepth / 2 + gap]}
        castShadow
      />
    </>
  );
}

export function TheRoomSunlight({
  roomWidth,
  roomDepth,
  roomHeight,
}: {
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
}) {
  const beamGeometry = useBeamGeometry();
  const beamMaterial = useBeamMaterial();
  const wallX = windowWallX(roomWidth);

  const sun = useMemo(() => {
    const light = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    light.position.copy(SUN_DIRECTION).multiplyScalar(-30);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.radius = SHADOW_BLUR;
    light.shadow.blurSamples = SHADOW_BLUR_SAMPLES;
    const reach = Math.max(roomWidth, roomDepth) * 0.9;
    const cam = light.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 1;
    cam.far = 70;
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.03;
    return light;
  }, [roomWidth, roomDepth]);

  useEffect(() => () => sun.dispose(), [sun]);

  // The default shadow filter ignores `radius`. Variance shadow maps honor it, so the blur works.
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useLayoutEffect(() => {
    gl.shadowMap.type = THREE.VSMShadowMap;
    // With a fixed sun nothing in the shadow map moves, so it is only redrawn when the scene changes.
    gl.shadowMap.autoUpdate = SUN_DRIFT !== 0;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  // Models load in after the first frame. Watch for shadow casters appearing and redraw then.
  const shadowWatch = useMemo(() => ({ elapsed: 0, casters: -1 }), []);
  useFrame((_, delta) => {
    if (SUN_DRIFT !== 0) return;
    shadowWatch.elapsed += delta;
    if (shadowWatch.elapsed < 0.5) return;
    shadowWatch.elapsed = 0;
    let casters = 0;
    scene.traverse((obj) => {
      if (obj.castShadow) casters++;
    });
    if (casters !== shadowWatch.casters) {
      shadowWatch.casters = casters;
      gl.shadowMap.needsUpdate = true;
    }
  });

  // The sun creeps across the sky so the window light crawls over the floor, thin clouds pass
  // in front of it, and the color warms and cools over a few minutes.
  useFrame((state) => {
    const t = state.clock.elapsedTime * SUN_DRIFT;
    const dir = roomSun.direction
      .set(
        SUN_DIRECTION.x,
        SUN_DIRECTION.y + Math.sin(t * 0.027 + 1.3) * 0.1,
        SUN_DIRECTION.z + Math.sin(t * 0.035) * 0.22,
      )
      .normalize();
    roomSun.cloud = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.19) * Math.sin(t * 0.11 + 1.7));
    const warm = 0.5 + 0.5 * Math.sin(t * 0.02 - 1);

    sun.position.copy(dir).multiplyScalar(-30);
    sun.color.copy(SUN_COLOR_COOL).lerp(SUN_COLOR_WARM, warm);
    sun.intensity = SUN_INTENSITY * roomSun.cloud;

    const u = beamMaterial.uniforms;
    // Window groups face into the room with rotation -PI/2 about Y: local +Z = world -X.
    (u.uShear.value as THREE.Vector2).set(dir.z / -dir.x, dir.y / -dir.x);
    (u.uColor.value as THREE.Color).copy(sun.color);
    u.uIntensity.value = BEAM_INTENSITY * roomSun.cloud;
  });

  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <SunShadowCasters roomWidth={roomWidth} roomDepth={roomDepth} roomHeight={roomHeight} />
      {WINDOW_Z.map((z) => (
        <group key={z} position={[wallX, WINDOW_BASE_Y, z]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh geometry={beamGeometry} material={beamMaterial} frustumCulled={false} />
        </group>
      ))}
    </>
  );
}
