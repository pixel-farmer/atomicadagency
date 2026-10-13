'use client';

import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TheRoomSunlight } from '@/components/assists/the-room/TheRoomSunlight';
import { TheRoomRightWallWindows } from '@/components/assists/the-room/TheRoomWindows';
import { roomTouchInput } from '@/components/assists/the-room/theRoomPuzzle';

export const ROOM_WIDTH = 14;
export const ROOM_DEPTH = 18;
export const ROOM_HEIGHT = 12;

const EYE_HEIGHT = 2.9;
const START_POSITION = new THREE.Vector3(0, EYE_HEIGHT, 6);

/** How close the camera may get to the walls. */
const BODY_RADIUS = 0.45;
const WALK_SPEED = 3.2;
const TURN_SPEED = 1.9;
/** Higher = snappier start/stop; lower = more glide. */
const MOVE_SMOOTHING = 10;
const DRAG_LOOK_SENSITIVITY = 0.0035;
const MAX_PITCH = 1.2;

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

function FirstPersonControls() {
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
    const maxX = ROOM_WIDTH / 2 - BODY_RADIUS;
    const maxZ = ROOM_DEPTH / 2 - BODY_RADIUS;
    pos.x = THREE.MathUtils.clamp(pos.x, -maxX, maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, -maxZ, maxZ);
    pos.y = EYE_HEIGHT;

    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });

  return null;
}

const WALL_COLOR = '#8ba2a8';
const CEILING_COLOR = '#c8d6df';
const FLOOR_COLOR = '#816349';
const FLOOR_TEXTURE = '/wood-diamond.jpg';
const PEDESTAL_PATH = '/StonePedestal.glb';
/** Uniform scale. 1 is the model’s own size, about 0.9 m tall, and the base stays on the floor. */
const PEDESTAL_SCALE = 3;
/** Meters of floor covered by one repeat of the texture (four parquet panels). */
const FLOOR_TILE_SIZE = 2.5;

function WoodFloor() {
  const texture = useTexture(FLOOR_TEXTURE);
  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(ROOM_WIDTH / FLOOR_TILE_SIZE, ROOM_DEPTH / FLOOR_TILE_SIZE);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
      <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  );
}

useGLTF.preload(PEDESTAL_PATH);

function StonePedestal() {
  const { scene } = useGLTF(PEDESTAL_PATH);
  const pedestal = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return <primitive object={pedestal} position={[0, 0.002, 0]} scale={PEDESTAL_SCALE} />;
}

function RoomShell() {
  // BoxGeometry face order: +x, -x, +y (ceiling), -y (floor), +z, -z.
  const materials = useMemo(() => {
    // A little self-glow keeps the colors from going gray where the single light barely reaches.
    const surface = (color: string, glow: number) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: glow,
        roughness: 0.95,
        side: THREE.BackSide,
      });
    const wall = surface(WALL_COLOR, 0.35);
    const ceiling = surface(CEILING_COLOR, 0.55);
    const floor = surface(FLOOR_COLOR, 0.25);
    return [wall, wall, ceiling, floor, wall, wall];
  }, []);

  useEffect(() => () => new Set(materials).forEach((m) => m.dispose()), [materials]);

  return (
    <mesh position={[0, ROOM_HEIGHT / 2, 0]} material={materials} receiveShadow>
      <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH]} />
    </mesh>
  );
}

export function TheRoomScene() {
  return (
    <>
      <color attach="background" args={[WALL_COLOR]} />
      <hemisphereLight args={['#f2f7fa', '#9aa892', 1.1]} />

      <RoomShell />
      <TheRoomSunlight roomWidth={ROOM_WIDTH} roomDepth={ROOM_DEPTH} roomHeight={ROOM_HEIGHT} />
      <Suspense fallback={null}>
        <TheRoomRightWallWindows roomWidth={ROOM_WIDTH} />
        <WoodFloor />
        <StonePedestal />
      </Suspense>

      <FirstPersonControls />
    </>
  );
}
