'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
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
const SUN_INTENSITY = 3.2;

/** The shafts of light you can see in the air (same streak idea as reactbits/lightrays). */
const BEAM_COLOR = '#fff3dc';
const BEAM_INTENSITY = 0.16;
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
  gl_FragColor = vec4(uColor * a, 1.0);
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
    const reach = Math.max(roomWidth, roomDepth) * 0.9;
    const cam = light.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 1;
    cam.far = 70;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.03;
    return light;
  }, [roomWidth, roomDepth]);

  useEffect(() => () => sun.dispose(), [sun]);

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
