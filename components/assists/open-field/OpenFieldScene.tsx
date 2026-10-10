'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TheRoomGrass } from '@/components/assists/the-room/TheRoomGrass';
import { roomTouchInput } from '@/components/assists/the-room/theRoomPuzzle';

const EYE_HEIGHT = 2.9;
const START_POSITION = new THREE.Vector3(0, EYE_HEIGHT, 0);

/** Blades live in a patch this size around the camera; the ground plane goes on far beyond. */
const GRASS_PATCH = 28;
const GRASS_BLADES = 300_000;
const GROUND_SIZE = 800;
/** How far from the start you can wander before the field gently holds you back. */
const FIELD_LIMIT = 300;

const WALK_SPEED = 3.2;
const TURN_SPEED = 1.9;
/** Higher = snappier start/stop; lower = more glide. */
const MOVE_SMOOTHING = 10;
const DRAG_LOOK_SENSITIVITY = 0.0035;
const MAX_PITCH = 1.2;

const HORIZON_COLOR = '#cfdde3';
const ZENITH_COLOR = '#7fa8c9';
const FOG_NEAR = 4;
const FOG_FAR = 70;

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

function FieldControls() {
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
  const pitch = useRef(0);
  const velocity = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    camera.position.copy(START_POSITION);
    yaw.current = 0;
    pitch.current = -0.08;
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  }, [camera]);

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
        pitch.current - (e.clientY - lastY) * DRAG_LOOK_SENSITIVITY,
        -MAX_PITCH,
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

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const k = keys.current;
    const pos = camera.position;

    yaw.current += ((k.turnLeft ? 1 : 0) - (k.turnRight ? 1 : 0)) * TURN_SPEED * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3()
      .addScaledVector(forward, (k.forward ? 1 : 0) - (k.back ? 1 : 0) + roomTouchInput.y)
      .addScaledVector(right, (k.right ? 1 : 0) - (k.left ? 1 : 0) + roomTouchInput.x);
    const wishLength = wish.length();
    if (wishLength > 1) wish.divideScalar(wishLength);
    wish.multiplyScalar(WALK_SPEED);

    velocity.current.lerp(wish, 1 - Math.exp(-MOVE_SMOOTHING * delta));
    pos.addScaledVector(velocity.current, delta);
    pos.x = THREE.MathUtils.clamp(pos.x, -FIELD_LIMIT, FIELD_LIMIT);
    pos.z = THREE.MathUtils.clamp(pos.z, -FIELD_LIMIT, FIELD_LIMIT);
    pos.y = EYE_HEIGHT;

    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });

  return null;
}

/** A gradient dome that rides along with the camera, so the horizon never gets closer. */
function SkyDome() {
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
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
          uniform vec3 uHorizon;
          uniform vec3 uZenith;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.6)), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    ref.current?.position.set(camera.position.x, 0, camera.position.z);
  });

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[450, 32, 16]} />
    </mesh>
  );
}

export function OpenFieldScene() {
  return (
    <>
      <color attach="background" args={[HORIZON_COLOR]} />
      <fog attach="fog" args={[HORIZON_COLOR, FOG_NEAR, FOG_FAR]} />
      <hemisphereLight args={['#f2f7fa', '#9aa892', 1.2]} />
      <directionalLight position={[30, 40, 20]} intensity={1.4} color="#fff6e8" />

      <SkyDome />
      <Suspense fallback={null}>
        <TheRoomGrass
          width={GRASS_PATCH}
          depth={GRASS_PATCH}
          followCamera
          groundSize={GROUND_SIZE}
          bladeCount={GRASS_BLADES}
        />
      </Suspense>

      <FieldControls />
    </>
  );
}
