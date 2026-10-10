'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TheRoomGrass } from '@/components/assists/the-room/TheRoomGrass';
import {
  CHAIR_SCALE,
  CHAIR_SEAT_HEIGHT,
  TheRoomModernChair,
} from '@/components/assists/the-room/TheRoomModernChair';
import { TheRoomRightWallWindows } from '@/components/assists/the-room/TheRoomWindows';
import {
  CALM_FALL_RATE,
  CALM_RISE_SECONDS,
  CHAIR_POSITION,
  createRoomPuzzleState,
  HINT_AFTER_SECONDS,
  HINT_RISE_SECONDS,
  roomTouchInput,
  STILL_DELAY,
  ZENO_FAR,
  ZENO_MIN,
  type RoomPuzzleState,
} from '@/components/assists/the-room/theRoomPuzzle';

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

const BASE_FOV = 60;
const MAX_DOLLY_FOV = 95;
/** How strongly the view widens as you push toward the chair (1 = the chair keeps its exact size). */
const DOLLY_STRENGTH = 0.6;

/** Where the glide ends: standing in front of the chair, before turning to sit. */
const APPROACH_DISTANCE = 0.5 + 0.5 * CHAIR_SCALE;
const GLIDE_SPEED = 0.9;
const SEAT_OFFSET = 0.08 * CHAIR_SCALE;
const SEATED_EYE_HEIGHT = CHAIR_SEAT_HEIGHT + 0.75;
/** Seated, facing the room and turned a little toward the windows. */
const SIT_YAW = Math.PI + 0.45;
const SIT_PITCH = -0.04;
const SIT_SECONDS = 3.2;
const STAND_SECONDS = 1.4;

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

function FirstPersonControls({ puzzle }: { puzzle: RoomPuzzleState }) {
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
  const walk = useRef({ hasWalked: false, stillTime: 0, walkTime: 0, engage: 0 });
  const glide = useRef({ elapsed: 0 });
  const transition = useRef({ t: 0, fromPos: new THREE.Vector3(), fromYaw: 0, fromPitch: 0 });

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
    const s = walk.current;
    const pos = camera.position;
    const approach = new THREE.Vector3(
      CHAIR_POSITION.x,
      EYE_HEIGHT,
      CHAIR_POSITION.y + APPROACH_DISTANCE,
    );

    yaw.current += ((k.turnLeft ? 1 : 0) - (k.turnRight ? 1 : 0)) * TURN_SPEED * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3()
      .addScaledVector(forward, (k.forward ? 1 : 0) - (k.back ? 1 : 0) + roomTouchInput.y)
      .addScaledVector(right, (k.right ? 1 : 0) - (k.left ? 1 : 0) + roomTouchInput.x);
    const wishLength = wish.length();
    if (wishLength > 1) wish.divideScalar(wishLength);
    wish.multiplyScalar(WALK_SPEED);
    const walking = wishLength > 0.15;

    const toChair = new THREE.Vector2(CHAIR_POSITION.x - pos.x, CHAIR_POSITION.y - pos.z);
    const chairDistance = toChair.length();
    toChair.divideScalar(Math.max(chairDistance, 1e-4));
    let approaching = false;

    const startTransition = (mode: 'sitting' | 'standing') => {
      puzzle.mode = mode;
      transition.current.t = 0;
      transition.current.fromPos.copy(pos);
      transition.current.fromYaw = yaw.current;
      transition.current.fromPitch = pitch.current;
      velocity.current.set(0, 0, 0);
    };

    if (puzzle.mode === 'free') {
      velocity.current.lerp(wish, 1 - Math.exp(-MOVE_SMOOTHING * delta));

      // Progress toward the chair shrinks the closer you get, so it stays just out of reach.
      const v = velocity.current;
      const inward = v.x * toChair.x + v.z * toChair.y;
      if (inward > 0) {
        const keep = THREE.MathUtils.smoothstep(chairDistance, ZENO_MIN, ZENO_FAR);
        v.x -= toChair.x * inward * (1 - keep);
        v.z -= toChair.y * inward * (1 - keep);
        approaching = walking && inward > WALK_SPEED * 0.3;
      }

      pos.addScaledVector(v, delta);
      const maxX = ROOM_WIDTH / 2 - BODY_RADIUS;
      const maxZ = ROOM_DEPTH / 2 - BODY_RADIUS;
      pos.x = THREE.MathUtils.clamp(pos.x, -maxX, maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, -maxZ, maxZ);
      pos.y = EYE_HEIGHT;
    } else if (puzzle.mode === 'gliding') {
      if (walking) {
        puzzle.mode = 'free';
      } else {
        glide.current.elapsed += delta;
        const remaining = pos.distanceTo(approach);
        const speed =
          GLIDE_SPEED *
          THREE.MathUtils.smoothstep(glide.current.elapsed, 0, 2.5) *
          (0.2 + 0.8 * THREE.MathUtils.smoothstep(remaining, 0, 2));
        const step = Math.min(Math.max(speed, 0.12) * delta, remaining);
        if (remaining > 1e-4) pos.addScaledVector(approach.clone().sub(pos).normalize(), step);
        if (remaining - step < 0.02) startTransition('sitting');
      }
    } else if (puzzle.mode === 'sitting') {
      const tr = transition.current;
      if (walking) {
        startTransition('standing');
      } else if (tr.t < 1) {
        tr.t = Math.min(1, tr.t + delta / SIT_SECONDS);
        const e = THREE.MathUtils.smootherstep(tr.t, 0, 1);
        const seat = new THREE.Vector3(CHAIR_POSITION.x, 0, CHAIR_POSITION.y + SEAT_OFFSET);
        pos.x = THREE.MathUtils.lerp(tr.fromPos.x, seat.x, e);
        pos.z = THREE.MathUtils.lerp(tr.fromPos.z, seat.z, e);
        pos.y = THREE.MathUtils.lerp(
          tr.fromPos.y,
          SEATED_EYE_HEIGHT,
          THREE.MathUtils.smootherstep(tr.t, 0.35, 1),
        );
        yaw.current = lerpAngle(tr.fromYaw, SIT_YAW, e);
        pitch.current = THREE.MathUtils.lerp(tr.fromPitch, SIT_PITCH, e);
      }
    } else if (puzzle.mode === 'standing') {
      const tr = transition.current;
      tr.t = Math.min(1, tr.t + delta / STAND_SECONDS);
      const e = THREE.MathUtils.smootherstep(tr.t, 0, 1);
      pos.lerpVectors(tr.fromPos, approach, e);
      if (tr.t >= 1) {
        // Back to the start of the puzzle: they have to walk, then be still again.
        puzzle.mode = 'free';
        s.hasWalked = false;
        s.stillTime = 0;
        s.walkTime = 0;
      }
    }

    if (walking) {
      if (puzzle.mode === 'free') s.hasWalked = true;
      s.stillTime = 0;
    } else {
      s.stillTime += delta;
    }
    if (walking && s.hasWalked && puzzle.mode === 'free' && puzzle.calm < 0.05) {
      s.walkTime += delta;
    }

    const seated = puzzle.mode === 'sitting' || puzzle.mode === 'gliding';
    const calmTarget = seated || (puzzle.mode === 'free' && s.hasWalked && s.stillTime > STILL_DELAY);
    puzzle.calm = calmTarget
      ? Math.min(1, puzzle.calm + delta / CALM_RISE_SECONDS)
      : Math.max(0, puzzle.calm - CALM_FALL_RATE * delta);

    if (puzzle.calm < 0.02) puzzle.pathStart.set(pos.x, pos.z);
    puzzle.pathEnd.set(approach.x, approach.z);
    puzzle.pathReveal = THREE.MathUtils.smoothstep(puzzle.calm, 0.25, 1);

    const hintTarget = s.walkTime > HINT_AFTER_SECONDS && puzzle.calm < 0.5;
    puzzle.hint = hintTarget
      ? Math.min(1, puzzle.hint + delta / HINT_RISE_SECONDS)
      : Math.max(0, puzzle.hint - 0.5 * delta);

    if (puzzle.mode === 'free' && !walking && puzzle.calm >= 1) {
      puzzle.mode = 'gliding';
      glide.current.elapsed = 0;
    }

    // Vertigo zoom: walking at the chair widens the view so it never seems to grow.
    s.engage +=
      ((approaching && chairDistance < ZENO_FAR ? 1 : 0) - s.engage) * (1 - Math.exp(-1.5 * delta));
    const ratio = Math.max(1, ZENO_FAR / Math.max(chairDistance, 0.5));
    const dollyFov = Math.min(
      MAX_DOLLY_FOV,
      THREE.MathUtils.radToDeg(
        2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * ratio ** DOLLY_STRENGTH),
      ),
    );
    const fov = BASE_FOV + (dollyFov - BASE_FOV) * s.engage * (1 - puzzle.calm);
    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - fov) > 0.01) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }

    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });

  return null;
}

function lerpAngle(from: number, to: number, t: number) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * t;
}

const WALL_COLOR = '#a9c2d4';
const CEILING_COLOR = '#c8d6df';

function RoomShell() {
  // BoxGeometry face order: +x, -x, +y (ceiling), -y (floor, hidden under the lawn), +z, -z.
  const materials = useMemo(() => {
    // A little self-glow keeps the blue from going gray where the single light barely reaches.
    const wall = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      emissive: WALL_COLOR,
      emissiveIntensity: 0.35,
      roughness: 0.95,
      side: THREE.BackSide,
    });
    const ceiling = new THREE.MeshStandardMaterial({
      color: CEILING_COLOR,
      emissive: CEILING_COLOR,
      emissiveIntensity: 0.55,
      roughness: 0.95,
      side: THREE.BackSide,
    });
    return [wall, wall, ceiling, wall, wall, wall];
  }, []);

  useEffect(() => () => new Set(materials).forEach((m) => m.dispose()), [materials]);

  return (
    <mesh position={[0, ROOM_HEIGHT / 2, 0]} material={materials}>
      <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH]} />
    </mesh>
  );
}

export function TheRoomScene({ puzzle: sharedPuzzle }: { puzzle?: RoomPuzzleState } = {}) {
  const ownPuzzle = useMemo(createRoomPuzzleState, []);
  const puzzle = sharedPuzzle ?? ownPuzzle;
  return (
    <>
      <color attach="background" args={[WALL_COLOR]} />
      <hemisphereLight args={['#f2f7fa', '#9aa892', 1.1]} />
      <pointLight position={[0, ROOM_HEIGHT - 1.2, 0]} intensity={14} distance={0} decay={1.6} />

      <RoomShell />
      <Suspense fallback={null}>
        <TheRoomRightWallWindows roomWidth={ROOM_WIDTH} />
        <TheRoomGrass width={ROOM_WIDTH} depth={ROOM_DEPTH} puzzle={puzzle} />
        <TheRoomModernChair x={CHAIR_POSITION.x} z={CHAIR_POSITION.y} />
      </Suspense>

      <FirstPersonControls puzzle={puzzle} />
    </>
  );
}
