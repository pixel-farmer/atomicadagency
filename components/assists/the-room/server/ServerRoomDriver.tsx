'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FOCUS_DISTANCE } from '@/components/assists/the-room/server/serverRoomConfig';
import {
  drawLedPanel,
  drawScreen,
  ingest,
  leds,
  machineObjects,
  resetDisplay,
  screens,
  settle,
} from '@/components/assists/the-room/server/serverDisplays';
import { hudFocus } from '@/components/assists/the-room/server/serverStore';
import { feedQueue } from '@/components/assists/the-room/server/wikiFeed';

/** Edits drawn per frame at most. Bursts queue up instead of stalling a frame. */
const EDITS_PER_FRAME = 14;
/** Monitors redrawn per frame, round robin. */
const SCREENS_PER_FRAME = 3;
/** Frames between checks for which machine is in the middle of the view. */
const FOCUS_EVERY = 6;

const CENTER = new THREE.Vector2(0, 0);

/** Moves edits from the feed into the room and redraws the canvases. Renders nothing. */
export function ServerRoomDriver() {
  const camera = useThree((s) => s.camera);
  const ray = useMemo(() => {
    const r = new THREE.Raycaster();
    r.far = FOCUS_DISTANCE;
    return r;
  }, []);
  const tick = useRef({ frame: 0, nextScreen: 0 });

  useEffect(() => {
    resetDisplay();
    return () => hudFocus.set(null);
  }, []);

  useFrame((state, rawDelta) => {
    const t = state.clock.elapsedTime;
    const delta = Math.min(rawDelta, 0.05);
    const now = performance.now();
    const k = tick.current;
    k.frame++;

    for (let i = 0; i < EDITS_PER_FRAME && feedQueue.length; i++) {
      const ev = feedQueue.shift();
      if (ev) ingest(ev, now);
    }
    settle(delta, now);

    for (let i = 0; i < SCREENS_PER_FRAME && screens.length; i++) {
      drawScreen(screens[k.nextScreen % screens.length], t);
      k.nextScreen++;
    }
    for (const panel of leds) drawLedPanel(panel);

    if (k.frame % FOCUS_EVERY === 0) {
      ray.setFromCamera(CENTER, camera);
      const hit = ray.intersectObjects([...machineObjects.values()], true)[0];
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object && typeof object.userData.machineId !== 'string') object = object.parent;
      hudFocus.set(object ? (object.userData.machineId as string) : null);
    }
  });

  return null;
}
