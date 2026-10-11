'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OpenFieldGrass } from '@/components/assists/open-field/OpenFieldGrass';
import { roomTouchInput } from '@/components/assists/the-room/theRoomPuzzle';
import { skyCloudsGlsl } from '@/components/assists/the-room/skyClouds';

/** Blades live in a patch this size around the ball; the ground plane goes on far beyond. */
const GRASS_PATCH = 28;
const GRASS_BLADES = 300_000;
const GROUND_SIZE = 800;
/** How far from the start the ball can roll before the field gently holds it back. */
const FIELD_LIMIT = 300;

const BALL_RADIUS = 0.6;
/** How far the ball settles into the grass, so it rests in it rather than on the tips. */
const BALL_SINK = 0.1;
/** Index of refraction. 1.5 is ordinary glass; higher bends the view through the ball more. */
const GLASS_IOR = 1.55;
/**
 * The camera looks down on the ball, so the refracted view points into the grass
 * and only the pale horizon sneaks in at the bottom. Pitch that view up (radians)
 * until the horizon crosses the ball and the clouds are visible.
 */
const GLASS_VIEW_LIFT = 0.08;
/** Extra upward bend at the left and right rims, so the horizon bows toward the edges. */
const GLASS_RIM_BEND = 0.08;
/** Very faint body color. Keep this near white; green tints read as milky. */
const GLASS_TINT = '#f4f6f7';
/** Scales the Fresnel reflection. 1 is physical glass; lower keeps the middle clearer. */
const GLASS_REFLECTION = 1;
/** Schlick reflectance at a head-on view. About 0.04 for glass. */
const GLASS_F0 = 0.04;
/** Cube map resolution. 512 or 1024; no mips, so this is what keeps the interior sharp. */
const GLASS_CUBE_SIZE = 1024;
/** Recapture the cube map after the ball has moved this far, not on every frame. */
const GLASS_CUBE_RECAPTURE_DISTANCE = 3;
const BALL_SPEED = 4;
/** Higher = snappier start/stop; lower = more glide. */
const BALL_SMOOTHING = 4;
/** How far the grass parts around the ball and the trail it leaves (meters from its center). */
const BALL_PART_RADIUS = 1;

/** Follow camera: distance behind the ball and the default downward tilt (radians). */
const CAMERA_DISTANCE = 6.5;
const CAMERA_PITCH = 0.32;
const MIN_PITCH = 0.08;
const MAX_PITCH = 1.1;
const TURN_SPEED = 1.9;
const DRAG_LOOK_SENSITIVITY = 0.0035;

const HORIZON_COLOR = '#cfdde3';
const ZENITH_COLOR = '#7fa8c9';
/** Multiplies the shared cloud drift; 1 matches the sky seen through The Room's windows. */
const CLOUD_DRIFT_SPEED = 3;
const FOG_NEAR = 4;
const FOG_FAR = 70;
const SUN_POSITION: [number, number, number] = [30, 40, 20];

type Ball = { position: THREE.Vector3; velocity: THREE.Vector3 };

type Keys = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  turnLeft: boolean;
  turnRight: boolean;
};

const KEY_BINDINGS: Record<string, keyof Keys> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowLeft: 'turnLeft',
  ArrowRight: 'turnRight',
};

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Keys and joystick roll the ball relative to the view; dragging orbits the camera around it. */
function BallControls({ ball }: { ball: Ball }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useRef<Keys>({
    forward: false,
    back: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
  });
  const yaw = useRef(0);
  const pitch = useRef(CAMERA_PITCH);

  useEffect(() => {
    const setKey = (e: KeyboardEvent, down: boolean) => {
      const action = KEY_BINDINGS[e.code];
      if (!action || isTypingTarget(e.target)) return;
      // Arrow keys would otherwise scroll the page behind the scene.
      e.preventDefault();
      keys.current[action] = down;
    };
    const onDown = (e: KeyboardEvent) => setKey(e, true);
    const onUp = (e: KeyboardEvent) => setKey(e, false);
    const clear = () => {
      for (const k of Object.keys(keys.current) as (keyof Keys)[]) keys.current[k] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (e.clientX - lastX) * DRAG_LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + (e.clientY - lastY) * DRAG_LOOK_SENSITIVITY,
        MIN_PITCH,
        MAX_PITCH,
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [gl]);

  const placeCamera = () => {
    const p = ball.position;
    const flat = Math.cos(pitch.current) * CAMERA_DISTANCE;
    camera.position.set(
      p.x + Math.sin(yaw.current) * flat,
      p.y + Math.sin(pitch.current) * CAMERA_DISTANCE,
      p.z + Math.cos(yaw.current) * flat,
    );
    camera.lookAt(p.x, p.y + BALL_RADIUS * 0.6, p.z);
  };

  useLayoutEffect(placeCamera);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;

    yaw.current += ((k.turnLeft ? 1 : 0) - (k.turnRight ? 1 : 0)) * TURN_SPEED * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3()
      .addScaledVector(forward, (k.forward ? 1 : 0) - (k.back ? 1 : 0) + roomTouchInput.y)
      .addScaledVector(right, (k.right ? 1 : 0) - (k.left ? 1 : 0) + roomTouchInput.x);
    const wishLength = wish.length();
    if (wishLength > 1) wish.divideScalar(wishLength);
    wish.multiplyScalar(BALL_SPEED);

    ball.velocity.lerp(wish, 1 - Math.exp(-BALL_SMOOTHING * delta));
    ball.position.addScaledVector(ball.velocity, delta);
    ball.position.x = THREE.MathUtils.clamp(ball.position.x, -FIELD_LIMIT, FIELD_LIMIT);
    ball.position.z = THREE.MathUtils.clamp(ball.position.z, -FIELD_LIMIT, FIELD_LIMIT);

    placeCamera();
  });

  return null;
}

const glassVertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Solid glass sphere. The view refracts in the front, crosses the ball, and refracts out the
 * back, which flips and magnifies the cube map. Edges reflect the same map (Schlick).
 */
const glassFragmentShader = /* glsl */ `
uniform samplerCube uCube;
uniform float uIor;
uniform float uRadius;
uniform float uF0;
uniform float uReflection;
uniform float uLift;
uniform float uRimBend;
uniform vec3 uTint;
uniform vec3 uCenter;
uniform vec3 uSunDir;

varying vec3 vWorldPos;
varying vec3 vNormal;

vec3 sampleCube(vec3 dir) {
  // Cube render targets are mirrored on X relative to world directions.
  return textureCube(uCube, vec3(-dir.x, dir.y, dir.z)).rgb;
}

// Pitch a direction up toward the sky, around the axis perpendicular to world up.
vec3 aimUp(vec3 dir, float angle) {
  vec3 axis = cross(dir, vec3(0.0, 1.0, 0.0));
  float len2 = dot(axis, axis);
  if (len2 < 1e-6) return dir;
  axis *= inversesqrt(len2);
  float s = sin(angle);
  float c = cos(angle);
  return dir * c + cross(axis, dir) * s + axis * dot(axis, dir) * (1.0 - c);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 I = normalize(vWorldPos - cameraPosition);
  float facing = clamp(dot(N, -I), 0.0, 1.0);

  vec3 into = refract(I, N, 1.0 / uIor);
  vec3 exitPos = vWorldPos + into * (-2.0 * uRadius * dot(into, N));
  vec3 exitN = normalize(exitPos - uCenter);
  vec3 outDir = refract(into, -exitN, uIor);
  if (dot(outDir, outDir) < 1e-4) outDir = reflect(into, -exitN);
  vec3 sideAxis = cross(vec3(0.0, 1.0, 0.0), -I);
  float sideLen2 = dot(sideAxis, sideAxis);
  float side = sideLen2 > 1e-6 ? dot(N, sideAxis * inversesqrt(sideLen2)) : 0.0;
  outDir = aimUp(normalize(outDir), uLift + side * side * uRimBend);

  vec3 refracted = sampleCube(outDir);
  vec3 reflected = sampleCube(reflect(I, N));
  float fresnel = uF0 + (1.0 - uF0) * pow(1.0 - facing, 5.0);
  fresnel = clamp(fresnel * uReflection, 0.0, 1.0);

  vec3 color = mix(refracted, reflected, fresnel) * uTint;
  // Grazing rays travel farther through the glass, so the rim absorbs a little more.
  color *= mix(1.0, 0.62, pow(1.0 - facing, 1.65));

  vec3 V = -I;
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 768.0);
  color += vec3(1.0, 0.98, 0.94) * spec * 2.2;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

function GlassBall({ ball }: { ball: Ball }) {
  const ref = useRef<THREE.Mesh>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const spin = useMemo(() => new THREE.Quaternion(), []);
  const capturedAt = useRef(new THREE.Vector3(1e6, 1e6, 1e6));
  const frame = useRef(0);

  const cubeTarget = useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(GLASS_CUBE_SIZE, {
      type: THREE.HalfFloatType,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return target;
  }, []);
  const cubeCamera = useMemo(() => new THREE.CubeCamera(0.05, 900, cubeTarget), [cubeTarget]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVertexShader,
        fragmentShader: glassFragmentShader,
        uniforms: {
          uCube: { value: cubeTarget.texture },
          uIor: { value: GLASS_IOR },
          uRadius: { value: BALL_RADIUS },
          uF0: { value: GLASS_F0 },
          uReflection: { value: GLASS_REFLECTION },
          uLift: { value: GLASS_VIEW_LIFT },
          uRimBend: { value: GLASS_RIM_BEND },
          uTint: { value: new THREE.Color(GLASS_TINT) },
          uCenter: { value: new THREE.Vector3() },
          uSunDir: { value: new THREE.Vector3(...SUN_POSITION).normalize() },
        },
      }),
    [cubeTarget],
  );

  useEffect(
    () => () => {
      material.dispose();
      cubeTarget.dispose();
    },
    [material, cubeTarget],
  );

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const delta = Math.min(rawDelta, 0.05);
    mesh.position.copy(ball.position);
    (material.uniforms.uCenter.value as THREE.Vector3).copy(ball.position);

    const v = ball.velocity;
    const speed = Math.hypot(v.x, v.z);
    if (speed > 1e-4) {
      axis.set(v.z, 0, -v.x).divideScalar(speed);
      spin.setFromAxisAngle(axis, (speed * delta) / BALL_RADIUS);
      mesh.quaternion.premultiply(spin);
    }

    frame.current += 1;
    const moved = capturedAt.current.distanceTo(ball.position);
    const startup = frame.current === 24;
    const arrived = speed < 0.2 && moved > 0.5;
    const traveled = moved > GLASS_CUBE_RECAPTURE_DISTANCE;
    if (!startup && !arrived && !traveled) return;

    mesh.visible = false;
    cubeCamera.position.copy(ball.position);
    cubeCamera.update(gl, scene);
    mesh.visible = true;
    capturedAt.current.copy(ball.position);
  });

  return (
    <mesh ref={ref} material={material}>
      <sphereGeometry args={[BALL_RADIUS, 64, 48]} />
    </mesh>
  );
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: new THREE.Color(HORIZON_COLOR) },
      uZenith: { value: new THREE.Color(ZENITH_COLOR) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vDir;
      ${skyCloudsGlsl}
      void main() {
        gl_FragColor = vec4(skyWithClouds(normalize(vDir), uTime, uHorizon, uZenith), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** A gradient dome that rides along with the camera, so the horizon never gets closer. */
function SkyDome() {
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(skyMaterial, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    ref.current?.position.set(camera.position.x, 0, camera.position.z);
    material.uniforms.uTime.value = state.clock.getElapsedTime() * CLOUD_DRIFT_SPEED;
  });

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[450, 32, 16]} />
    </mesh>
  );
}

export function OpenFieldScene() {
  const ball = useMemo<Ball>(
    () => ({
      position: new THREE.Vector3(0, BALL_RADIUS - BALL_SINK, 0),
      velocity: new THREE.Vector3(),
    }),
    [],
  );

  return (
    <>
      <color attach="background" args={[HORIZON_COLOR]} />
      <fog attach="fog" args={[HORIZON_COLOR, FOG_NEAR, FOG_FAR]} />
      <hemisphereLight args={['#f2f7fa', '#9aa892', 1.2]} />
      <directionalLight position={SUN_POSITION} intensity={1.4} color="#fff6e8" />

      <SkyDome />
      <Suspense fallback={null}>
        <OpenFieldGrass
          patchSize={GRASS_PATCH}
          groundSize={GROUND_SIZE}
          bladeCount={GRASS_BLADES}
          focus={ball.position}
          partRadius={BALL_PART_RADIUS}
          shadowRadius={BALL_RADIUS}
        />
      </Suspense>
      <GlassBall ball={ball} />

      <BallControls ball={ball} />
    </>
  );
}
