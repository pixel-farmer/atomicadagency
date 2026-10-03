'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Box3, Group, Object3D, Vector3 } from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const KOI_PATH = '/koi_fish_ow.glb';
/** Target body length in world units (water plane is 24). */
const KOI_TARGET_LENGTH = 2.8;
/** World Y of the water surface (matches flat water plane). */
const WATER_Y = 0;
const SWIM_DEPTH = 0.62;

const POND_HALF = 5;
/** Waypoints stay inside POND_HALF - EDGE_INSET. */
const EDGE_INSET = 1.2;
/** Fish steers back toward the center beyond this distance from the origin (per axis). */
const WALL_LIMIT = POND_HALF - 0.8;
const WAYPOINT_ARRIVE = 0.6;
const MIN_WAYPOINT_DIST = 2.0;

/**
 * Turning is speed-coupled: angular rate = speed / TURN_RADIUS, so the fish
 * carves a fixed-radius arc instead of pivoting on the spot. Faster = quicker turn.
 */
const TURN_RADIUS = 1.5;
/** Proportional steering gain (only matters for small heading errors). */
const TURN_GAIN = 2.0;

const BASE_SWIM_SPEED = 0.5;
const MIN_SWIM_SPEED = 0.2;
/** Extra forward speed at a full turn (1 = up to 2x cruise speed). */
const TURN_SPEED_BOOST = 1.0;
/** How fast the turn burst ramps up / relaxes (1/sec). */
const BOOST_RISE = 3.0;
const BOOST_FALL = 1.0;
/** Tail-beat animation speed range, scaled with actual swim speed. */
const ANIM_BASE_TIMESCALE = 0.85;
const ANIM_MIN_TIMESCALE = 0.6;
const ANIM_MAX_TIMESCALE = 2.0;

/** Pick a new waypoint if distance hasn't improved for this long. */
const NO_PROGRESS_SEC = 3.5;
/** Pick a new waypoint if one has been chased for this long. */
const WAYPOINT_TIMEOUT_SEC = 14;

/**
 * GLB body axis is Blender +X (head–tail). Three.js default forward is −Z.
 * Inner pivot: X −90° (unchanged pool orientation) + Y −90° maps local +X → parent +Z
 * so rig heading 0 swims toward world +Z and yaw rotates in XZ.
 */
const PIVOT_ORIENTATION: [number, number, number] = [-Math.PI / 2, -Math.PI / 2, 0];

function scaleToLength(root: Object3D, targetLength: number) {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  return targetLength / longest;
}

/** Underwater look without tinting away albedo when a diffuse map is present. */
function tuneUnderwaterMaterial(mat: THREE.Material) {
  if (mat instanceof THREE.MeshStandardMaterial) {
    if (mat.map) {
      mat.color.setRGB(1, 1, 1);
    } else {
      mat.color.setRGB(0.12, 0.13, 0.17);
    }
    mat.emissive.setRGB(0.015, 0.02, 0.03);
    mat.metalness = 0.08;
    mat.roughness = 0.92;
    mat.needsUpdate = true;
    return;
  }
  if (mat instanceof THREE.MeshBasicMaterial) {
    if (mat.map) {
      mat.color.setRGB(1, 1, 1);
    } else {
      mat.color.setRGB(0.14, 0.15, 0.19);
    }
    mat.needsUpdate = true;
  }
}

function cloneAndTuneMaterial(source: THREE.Material) {
  const mat = source.clone();
  tuneUnderwaterMaterial(mat);
  return mat;
}

/**
 * Skinned clone with unique materials so unmount dispose never strips maps from
 * the shared useGLTF cache (Clone + deep still shares materials by default).
 */
function cloneKoiForScene(source: Object3D) {
  const root = SkeletonUtils.clone(source) as Object3D;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => cloneAndTuneMaterial(m));
    } else if (obj.material) {
      obj.material = cloneAndTuneMaterial(obj.material);
    }
  });
  return root;
}

function pickSwimAction(actions: Record<string, THREE.AnimationAction | null | undefined>) {
  const names = ['Swim', 'swim', 'Swimming', 'Idle', 'idle', 'ArmatureAction', 'Animation'];
  for (const name of names) {
    if (actions[name]) return actions[name];
  }
  return Object.values(actions).find(Boolean);
}

/** Shortest signed angle from `current` to `target`, in (-π, π]. */
function signedAngleDiff(current: number, target: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True if the fish, heading `heading`, can reach (wx, wz) without orbiting it. */
function isReachable(from: Vector3, heading: number, wx: number, wz: number) {
  const dx = wx - from.x;
  const dz = wz - from.z;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const forward = dx * fx + dz * fz;
  const lateral = dx * fz - dz * fx;
  const R = TURN_RADIUS;
  // Turning circles are centered at (lateral = ±R, forward = 0)
  for (const side of [-1, 1]) {
    if (Math.hypot(lateral - side * R, forward) < R) return false;
  }
  return true;
}

function pickWaypoint(from: Vector3, heading: number): Vector3 {
  const limit = POND_HALF - EDGE_INSET;
  for (let i = 0; i < 40; i++) {
    const wx = (Math.random() * 2 - 1) * limit;
    const wz = (Math.random() * 2 - 1) * limit;
    if (Math.hypot(wx - from.x, wz - from.z) < MIN_WAYPOINT_DIST) continue;
    if (!isReachable(from, heading, wx, wz)) continue;
    return new Vector3(wx, from.y, wz);
  }
  // Fallback: straight ahead, clamped inside the pond
  return new Vector3(
    THREE.MathUtils.clamp(from.x + Math.sin(heading) * 3, -limit, limit),
    from.y,
    THREE.MathUtils.clamp(from.z + Math.cos(heading) * 3, -limit, limit),
  );
}

export function BlackWaterKoiFish() {
  const rigRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(KOI_PATH);

  const waypoint = useRef(new Vector3());
  const heading = useRef(0);
  const swimSpeed = useRef(BASE_SWIM_SPEED);
  const targetSwimSpeed = useRef(BASE_SWIM_SPEED);
  const turnBoost = useRef(0);
  const movementReady = useRef(false);
  const nextSpeedChangeAt = useRef(0);
  const waypointSetAt = useRef(0);
  const bestDist = useRef(Infinity);
  const lastProgressAt = useRef(0);
  const swimActionRef = useRef<THREE.AnimationAction | null>(null);

  const { scale, depthOffset, koiModel } = useMemo(() => {
    const s = scaleToLength(scene, KOI_TARGET_LENGTH);
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    return {
      scale: s,
      depthOffset: -center.y * s,
      koiModel: cloneKoiForScene(scene),
    };
  }, [scene]);

  const { actions } = useAnimations(animations, rigRef);

  useLayoutEffect(() => {
    const swim = pickSwimAction(actions);
    if (!swim) return;

    swim.reset().fadeIn(0.4).setLoop(THREE.LoopRepeat, Infinity).play();
    swim.timeScale = ANIM_BASE_TIMESCALE;
    swimActionRef.current = swim;

    return () => {
      swimActionRef.current = null;
      swim.fadeOut(0.2);
      swim.stop();
    };
  }, [actions]);

  useLayoutEffect(() => {
    const rig = rigRef.current;
    if (!rig || movementReady.current) return;

    const swimY = WATER_Y - SWIM_DEPTH + depthOffset;
    heading.current = Math.random() * Math.PI * 2;
    rig.position.set(0, swimY, 0);
    rig.rotation.set(0, heading.current, 0);
    waypoint.current.copy(pickWaypoint(rig.position, heading.current));
    movementReady.current = true;
  }, [depthOffset]);

  useFrame((state, delta) => {
    const rig = rigRef.current;
    if (!rig || !movementReady.current) return;
    delta = Math.min(delta, 0.05); // avoid huge jumps after tab switches

    const t = state.clock.elapsedTime;
    const swimY = WATER_Y - SWIM_DEPTH + depthOffset + Math.sin(t * 0.75) * 0.06;

    // Cruise-speed variation
    if (t >= nextSpeedChangeAt.current) {
      targetSwimSpeed.current = Math.max(
        MIN_SWIM_SPEED,
        BASE_SWIM_SPEED + (Math.random() - 0.5) * 0.14,
      );
      nextSpeedChangeAt.current = t + 2.5 + Math.random() * 2.5;
    }
    swimSpeed.current = THREE.MathUtils.lerp(
      swimSpeed.current,
      targetSwimSpeed.current,
      Math.min(1, delta * 0.35),
    );

    const px = rig.position.x;
    const pz = rig.position.z;
    let dist = Math.hypot(waypoint.current.x - px, waypoint.current.z - pz);

    // Track progress toward the current waypoint
    if (dist < bestDist.current - 0.05) {
      bestDist.current = dist;
      lastProgressAt.current = t;
    }

    const arrived = dist < WAYPOINT_ARRIVE;
    const noProgress = t - lastProgressAt.current > NO_PROGRESS_SEC;
    const timedOut = t - waypointSetAt.current > WAYPOINT_TIMEOUT_SEC;

    if (arrived || noProgress || timedOut) {
      waypoint.current.copy(pickWaypoint(rig.position, heading.current));
      waypointSetAt.current = t;
      lastProgressAt.current = t;
      dist = Math.hypot(waypoint.current.x - px, waypoint.current.z - pz);
      bestDist.current = dist;
    }

    // Target heading: toward waypoint, or toward center if too close to a wall
    let targetHeading = Math.atan2(
      waypoint.current.x - px,
      waypoint.current.z - pz,
    );
    if (Math.abs(px) > WALL_LIMIT || Math.abs(pz) > WALL_LIMIT) {
      targetHeading = Math.atan2(-px, -pz);
    }

    const err = signedAngleDiff(heading.current, targetHeading);

    // Burst of speed while turning (fish kick harder through a turn).
    // Smoothed so the speed ramps up fast and settles back gently.
    const turnFactor = Math.min(1, Math.abs(err) / (Math.PI / 2));
    const boostRate = turnFactor > turnBoost.current ? BOOST_RISE : BOOST_FALL;
    turnBoost.current = THREE.MathUtils.lerp(
      turnBoost.current,
      turnFactor,
      Math.min(1, delta * boostRate),
    );

    const speed = swimSpeed.current * (1 + TURN_SPEED_BOOST * turnBoost.current);

    // Speed-coupled turn rate: fixed-radius arc, no pivoting in place
    const maxTurnRate = speed / TURN_RADIUS;
    const turn = THREE.MathUtils.clamp(err * TURN_GAIN, -maxTurnRate, maxTurnRate);
    heading.current += turn * delta;

    const step = speed * delta;
    rig.position.x = THREE.MathUtils.clamp(
      px + Math.sin(heading.current) * step,
      -POND_HALF,
      POND_HALF,
    );
    rig.position.z = THREE.MathUtils.clamp(
      pz + Math.cos(heading.current) * step,
      -POND_HALF,
      POND_HALF,
    );
    rig.position.y = swimY;
    rig.rotation.set(0, heading.current, 0);

    // Tail beats faster when the fish swims faster
    const swim = swimActionRef.current;
    if (swim) {
      const target = THREE.MathUtils.clamp(
        ANIM_BASE_TIMESCALE * (speed / BASE_SWIM_SPEED),
        ANIM_MIN_TIMESCALE,
        ANIM_MAX_TIMESCALE,
      );
      swim.timeScale = THREE.MathUtils.lerp(
        swim.timeScale,
        target,
        Math.min(1, delta * 4),
      );
    }
  });

  return (
    <group ref={rigRef} renderOrder={0}>
      <group rotation={PIVOT_ORIENTATION}>
        <primitive object={koiModel} scale={scale} />
      </group>
    </group>
  );
}

useGLTF.preload(KOI_PATH);
