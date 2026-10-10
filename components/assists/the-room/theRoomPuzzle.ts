import * as THREE from 'three';

/**
 * The stillness puzzle: walking toward the chair never quite gets you there; standing still
 * calms the room, draws a path, and carries you to the chair to sit.
 */

/** Where the chair stands (x, z). It faces +Z, toward where the visitor starts. */
export const CHAIR_POSITION = new THREE.Vector2(0, -8.35);

/** Seconds without walking before the room starts to respond. */
export const STILL_DELAY = 3;
/** Seconds for calm to rise from 0 to 1 once the room responds. */
export const CALM_RISE_SECONDS = 7;
/** How fast calm drains (per second) once the visitor walks again. */
export const CALM_FALL_RATE = 0.7;

/** Walking toward the chair slows down inside ZENO_FAR and stops making progress at ZENO_MIN. */
export const ZENO_FAR = 12.5;
export const ZENO_MIN = 6;

/** Seconds of walking without discovering stillness before the grass hints at the path. */
export const HINT_AFTER_SECONDS = 25;
export const HINT_RISE_SECONDS = 5;

export type RoomMode = 'free' | 'gliding' | 'sitting' | 'standing';

/** Written by the movement controls every frame, read by the grass (and later the audio). */
export type RoomPuzzleState = {
  mode: RoomMode;
  /** 0 while walking, eases to 1 when the visitor has been still long enough. */
  calm: number;
  /** 0..1 faint lean along the future path, shown after a long time walking. */
  hint: number;
  /** 0..1 how far the flattened path has drawn itself from the visitor toward the chair. */
  pathReveal: number;
  pathStart: THREE.Vector2;
  pathEnd: THREE.Vector2;
};

export function createRoomPuzzleState(): RoomPuzzleState {
  return {
    mode: 'free',
    calm: 0,
    hint: 0,
    pathReveal: 0,
    pathStart: new THREE.Vector2(),
    pathEnd: CHAIR_POSITION.clone(),
  };
}

/**
 * On-screen joystick input for touch devices, -1..1 on each axis (y > 0 is forward).
 * Lives outside React because the joystick is DOM and the controls run inside the canvas.
 */
export const roomTouchInput = { x: 0, y: 0 };
