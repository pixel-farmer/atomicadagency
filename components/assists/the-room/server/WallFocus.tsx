'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OPS_WALL, OPS_WALL_ID, SERVER_ROOM } from '@/components/assists/the-room/server/serverRoomConfig';
import { cameraHold, hudFocus, wallView } from '@/components/assists/the-room/server/serverStore';

/** Seconds for the camera to glide in or out. */
const GLIDE_SECONDS = 1.1;
/** Breathing room around the board when framed, as a multiple of the tightest fit. */
const FRAME_MARGIN = 1.06;

type Phase = 'room' | 'in' | 'wall' | 'out';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FACING_WALL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0, 'YXZ'));

/**
 * Glides the camera to face the operations board and back. While it's framed, the walking
 * controls are held. Esc or E steps back; E also opens it when you're facing the board.
 */
export function WallFocus() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const state = useRef({
    phase: 'room' as Phase,
    t: 0,
    fromPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    savedPos: new THREE.Vector3(),
    savedQuat: new THREE.Quaternion(),
    target: new THREE.Vector3(),
  });

  useEffect(() => {
    const s = state.current;
    const follow = () => {
      const view = wallView.get();
      if (view === 'wall' && (s.phase === 'room' || s.phase === 'out')) {
        if (s.phase === 'room') {
          s.savedPos.copy(camera.position);
          s.savedQuat.copy(camera.quaternion);
        }
        s.fromPos.copy(camera.position);
        s.fromQuat.copy(camera.quaternion);
        s.phase = 'in';
        s.t = 0;
        cameraHold.current = true;
      } else if (view === 'room' && (s.phase === 'wall' || s.phase === 'in')) {
        s.fromPos.copy(camera.position);
        s.fromQuat.copy(camera.quaternion);
        s.phase = 'out';
        s.t = 0;
      }
    };
    const unsubscribe = wallView.subscribe(follow);

    // Capture phase, so Esc here runs before the scene's close button sees it.
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const inWall = wallView.get() === 'wall';
      if (e.key === 'Escape' && inWall) {
        e.preventDefault();
        e.stopImmediatePropagation();
        wallView.set('room');
      } else if (e.code === 'KeyE' && !e.repeat) {
        if (inWall) wallView.set('room');
        else if (hudFocus.get() === OPS_WALL_ID) wallView.set('wall');
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey, { capture: true });
      cameraHold.current = false;
      wallView.set('room');
    };
  }, [camera]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    if (s.phase === 'room') return;

    // Back far enough that the whole board fits the current window shape.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitHeight = OPS_WALL.height / 2 / tanHalf;
    const fitWidth = OPS_WALL.width / 2 / (tanHalf * camera.aspect);
    const distance = Math.min(Math.max(fitHeight, fitWidth) * FRAME_MARGIN, SERVER_ROOM.width - 0.6);
    s.target.set(-SERVER_ROOM.width / 2 + OPS_WALL.inset + distance, OPS_WALL.centerY, OPS_WALL.centerZ);

    if (s.phase === 'wall') {
      camera.position.copy(s.target);
      camera.quaternion.copy(FACING_WALL);
      return;
    }

    s.t = Math.min(1, s.t + Math.min(rawDelta, 0.05) / GLIDE_SECONDS);
    const k = ease(s.t);
    const toPos = s.phase === 'in' ? s.target : s.savedPos;
    const toQuat = s.phase === 'in' ? FACING_WALL : s.savedQuat;
    camera.position.lerpVectors(s.fromPos, toPos, k);
    camera.quaternion.slerpQuaternions(s.fromQuat, toQuat, k);

    if (s.t >= 1) {
      if (s.phase === 'in') {
        s.phase = 'wall';
      } else {
        s.phase = 'room';
        cameraHold.current = false;
      }
    }
  });

  return null;
}
