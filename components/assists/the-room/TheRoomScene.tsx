'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export const ROOM_WIDTH = 16;
export const ROOM_DEPTH = 16;
export const ROOM_HEIGHT = 5;

const SPHERE_RADIUS = 1;
const EYE_HEIGHT = 1.6;
const START_POSITION = new THREE.Vector3(0, EYE_HEIGHT, 6);

/** How close the camera may get to walls and the sphere. */
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

    yaw.current += ((k.turnLeft ? 1 : 0) - (k.turnRight ? 1 : 0)) * TURN_SPEED * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3()
      .addScaledVector(forward, (k.forward ? 1 : 0) - (k.back ? 1 : 0))
      .addScaledVector(right, (k.right ? 1 : 0) - (k.left ? 1 : 0));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(WALK_SPEED);

    velocity.current.lerp(wish, 1 - Math.exp(-MOVE_SMOOTHING * delta));

    const pos = camera.position;
    pos.addScaledVector(velocity.current, delta);

    const maxX = ROOM_WIDTH / 2 - BODY_RADIUS;
    const maxZ = ROOM_DEPTH / 2 - BODY_RADIUS;
    pos.x = THREE.MathUtils.clamp(pos.x, -maxX, maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, -maxZ, maxZ);

    const minDist = SPHERE_RADIUS + BODY_RADIUS;
    const dist = Math.hypot(pos.x, pos.z);
    if (dist < minDist) {
      const scale = minDist / Math.max(dist, 1e-4);
      pos.x = dist < 1e-4 ? minDist : pos.x * scale;
      pos.z = dist < 1e-4 ? 0 : pos.z * scale;
    }
    pos.y = EYE_HEIGHT;

    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });

  return null;
}

/**
 * The near-white floor clips to white under real shadow maps, and the sphere and light never
 * move, so the sphere is grounded with a static soft shadow texture instead.
 */
function SphereContactShadow() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.22, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  const size = SPHERE_RADIUS * 3.4;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function TheRoomScene() {
  return (
    <>
      <color attach="background" args={['#f4f4f4']} />
      <hemisphereLight args={['#ffffff', '#d8d8d8', 0.9]} />
      <pointLight position={[0, ROOM_HEIGHT - 0.6, 0]} intensity={22} distance={0} decay={1.6} />

      <mesh position={[0, ROOM_HEIGHT / 2, 0]}>
        <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} side={THREE.BackSide} />
      </mesh>

      <mesh position={[0, SPHERE_RADIUS, 0]}>
        <sphereGeometry args={[SPHERE_RADIUS, 64, 48]} />
        <meshStandardMaterial color="#050505" roughness={0.35} metalness={0.1} />
      </mesh>

      <SphereContactShadow />

      <FirstPersonControls />
    </>
  );
}
