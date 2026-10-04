'use client';

import { useAnimations, useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Box3, Group, Object3D, SRGBColorSpace, Vector3 } from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  KOI_SCHOOL,
  type KoiSwimmerSpec,
} from '@/components/assists/black-water-koi/koiSchoolConfig';
import {
  forEachKoiNeighbor,
  removeKoiSchoolPosition,
  setKoiSchoolPosition,
} from '@/components/assists/black-water-koi/koiSchoolPositions';

const KOI_PATH = '/koi_fish_ow.glb';
/** Target body length in world units. */
const KOI_TARGET_LENGTH = 2.8;
const WATER_Y = 0;
/** Fallback when a school entry omits `swimDepth`. */
const DEFAULT_SWIM_DEPTH = 0.62;

const POND_HALF = 5;
const EDGE_INSET = 1.2;
const WALL_LIMIT = POND_HALF - 0.8;
const WAYPOINT_ARRIVE = 0.6;
const MIN_WAYPOINT_DIST = 2.0;
/** First waypoint after spawn — keeps fish from clustering on open. */
const INITIAL_WAYPOINT_MIN_DIST = 3.35;

const TURN_RADIUS = 1.5;
const TURN_GAIN = 2.0;

const BASE_SWIM_SPEED = 0.5;
const MIN_SWIM_SPEED = 0.2;
const TURN_SPEED_BOOST = 1.0;
const BOOST_RISE = 3.0;
const BOOST_FALL = 1.0;
const ANIM_BASE_TIMESCALE = 0.85;
const ANIM_MIN_TIMESCALE = 0.6;
const ANIM_MAX_TIMESCALE = 2.0;

const NO_PROGRESS_SEC = 3.5;
const WAYPOINT_TIMEOUT_SEC = 14;
/** Steer away when another fish is within this XZ distance (~body length). */
const NEIGHBOR_SEP_RADIUS = 2.15;
const NEIGHBOR_AVOID_BLEND = 2.8;

const PIVOT_ORIENTATION: [number, number, number] = [-Math.PI / 2, -Math.PI / 2, 0];

function scaleToLength(root: Object3D, targetLength: number) {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  return targetLength / longest;
}

function tuneUnderwaterMaterial(mat: THREE.Material) {
  if (mat instanceof THREE.MeshStandardMaterial) {
    mat.color.setRGB(1, 1, 1);
    mat.emissive.setRGB(0.015, 0.02, 0.03);
    mat.metalness = 0.08;
    mat.roughness = 0.92;
    mat.needsUpdate = true;
    return;
  }
  if (mat instanceof THREE.MeshBasicMaterial) {
    mat.color.setRGB(1, 1, 1);
    mat.needsUpdate = true;
  }
}

function applyDiffuseToMaterial(mat: THREE.Material, map: THREE.Texture) {
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshBasicMaterial
  ) {
    mat.map = map;
    mat.color.setRGB(1, 1, 1);
    mat.needsUpdate = true;
  }
}

function cloneKoiForScene(source: Object3D, diffuseMap: THREE.Texture) {
  const root = SkeletonUtils.clone(source) as Object3D;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const assign = (sourceMat: THREE.Material) => {
      const mat = sourceMat.clone();
      tuneUnderwaterMaterial(mat);
      applyDiffuseToMaterial(mat, diffuseMap);
      return mat;
    };
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => assign(m));
    } else if (obj.material) {
      obj.material = assign(obj.material);
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

function signedAngleDiff(current: number, target: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(current: number, target: number, t: number) {
  return current + signedAngleDiff(current, target) * t;
}

function blendNeighborAvoidance(
  px: number,
  pz: number,
  targetHeading: number,
  selfId: string,
  delta: number,
) {
  let ax = 0;
  let az = 0;
  forEachKoiNeighbor(selfId, (ox, oz) => {
    const dx = px - ox;
    const dz = pz - oz;
    const d = Math.hypot(dx, dz);
    if (d >= NEIGHBOR_SEP_RADIUS || d < 1e-5) return;
    const w = (NEIGHBOR_SEP_RADIUS - d) / NEIGHBOR_SEP_RADIUS;
    ax += (dx / d) * w;
    az += (dz / d) * w;
  });
  if (ax * ax + az * az < 1e-8) return targetHeading;
  const avoidHeading = Math.atan2(ax, az);
  const t = Math.min(1, delta * NEIGHBOR_AVOID_BLEND);
  return lerpAngle(targetHeading, avoidHeading, t);
}

function isReachable(from: Vector3, heading: number, wx: number, wz: number) {
  const dx = wx - from.x;
  const dz = wz - from.z;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const forward = dx * fx + dz * fz;
  const lateral = dx * fz - dz * fx;
  const R = TURN_RADIUS;
  for (const side of [-1, 1]) {
    if (Math.hypot(lateral - side * R, forward) < R) return false;
  }
  return true;
}

function pickWaypoint(
  from: Vector3,
  heading: number,
  minDist = MIN_WAYPOINT_DIST,
): Vector3 {
  const limit = POND_HALF - EDGE_INSET;
  for (let i = 0; i < 40; i++) {
    const wx = (Math.random() * 2 - 1) * limit;
    const wz = (Math.random() * 2 - 1) * limit;
    if (Math.hypot(wx - from.x, wz - from.z) < minDist) continue;
    if (!isReachable(from, heading, wx, wz)) continue;
    return new Vector3(wx, from.y, wz);
  }
  return new Vector3(
    THREE.MathUtils.clamp(from.x + Math.sin(heading) * 3, -limit, limit),
    from.y,
    THREE.MathUtils.clamp(from.z + Math.cos(heading) * 3, -limit, limit),
  );
}

function KoiSwimmer({ spec }: { spec: KoiSwimmerSpec }) {
  const rigRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(KOI_PATH);
  const diffuseMap = useTexture(spec.diffuse);

  const speedScale = spec.speedScale ?? 1;
  const lengthScale = spec.lengthScale ?? 1;
  const targetLength = KOI_TARGET_LENGTH * lengthScale;
  /** From config only — Y does not drift or bob at runtime. */
  const swimDepth = spec.swimDepth ?? DEFAULT_SWIM_DEPTH;

  const waypoint = useRef(new Vector3());
  const heading = useRef(0);
  const swimSpeed = useRef(BASE_SWIM_SPEED * speedScale);
  const targetSwimSpeed = useRef(BASE_SWIM_SPEED * speedScale);
  const turnBoost = useRef(0);
  const movementReady = useRef(false);
  const timingReady = useRef(false);
  const nextSpeedChangeAt = useRef(0);
  const waypointSetAt = useRef(0);
  const bestDist = useRef(Infinity);
  const lastProgressAt = useRef(0);
  const swimActionRef = useRef<THREE.AnimationAction | null>(null);

  useLayoutEffect(() => {
    diffuseMap.colorSpace = SRGBColorSpace;
    diffuseMap.anisotropy = 4;
    diffuseMap.needsUpdate = true;
  }, [diffuseMap]);

  const { scale, depthOffset, koiModel } = useMemo(() => {
    const s = scaleToLength(scene, targetLength);
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    return {
      scale: s,
      depthOffset: -center.y * s,
      koiModel: cloneKoiForScene(scene, diffuseMap),
    };
  }, [scene, diffuseMap, targetLength]);

  const { actions } = useAnimations(animations, rigRef);

  useLayoutEffect(() => {
    return () => removeKoiSchoolPosition(spec.id);
  }, [spec.id]);

  useLayoutEffect(() => {
    const swim = pickSwimAction(actions);
    if (!swim) return;

    swim.reset().fadeIn(0.4).setLoop(THREE.LoopRepeat, Infinity).play();
    swim.timeScale = ANIM_BASE_TIMESCALE;
    const duration = swim.getClip().duration;
    if (duration > 0 && spec.animPhase != null) {
      swim.time = duration * spec.animPhase;
    }
    swimActionRef.current = swim;

    return () => {
      swimActionRef.current = null;
      swim.fadeOut(0.2);
      swim.stop();
    };
  }, [actions, spec.animPhase]);

  useLayoutEffect(() => {
    const rig = rigRef.current;
    if (!rig || movementReady.current) return;

    const swimY = WATER_Y - swimDepth + depthOffset;
    heading.current = Math.random() * Math.PI * 2;
    rig.position.set(spec.spawn[0], swimY, spec.spawn[1]);
    rig.rotation.set(0, heading.current, 0);
    waypoint.current.copy(
      pickWaypoint(rig.position, heading.current, INITIAL_WAYPOINT_MIN_DIST),
    );
    movementReady.current = true;
    timingReady.current = false;
  }, [depthOffset, spec.spawn, swimDepth]);

  useFrame((state, delta) => {
    const rig = rigRef.current;
    if (!rig || !movementReady.current) return;
    delta = Math.min(delta, 0.05);

    const t = state.clock.elapsedTime;
    const swimY = WATER_Y - swimDepth + depthOffset;

    const px = rig.position.x;
    const pz = rig.position.z;
    let dist = Math.hypot(waypoint.current.x - px, waypoint.current.z - pz);

    if (!timingReady.current) {
      waypointSetAt.current = t;
      lastProgressAt.current = t;
      bestDist.current = dist;
      timingReady.current = true;
    }

    if (t >= nextSpeedChangeAt.current) {
      targetSwimSpeed.current = Math.max(
        MIN_SWIM_SPEED,
        BASE_SWIM_SPEED * speedScale + (Math.random() - 0.5) * 0.14,
      );
      nextSpeedChangeAt.current = t + 2.5 + Math.random() * 2.5;
    }
    swimSpeed.current = THREE.MathUtils.lerp(
      swimSpeed.current,
      targetSwimSpeed.current,
      Math.min(1, delta * 0.35),
    );

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

    let targetHeading = Math.atan2(
      waypoint.current.x - px,
      waypoint.current.z - pz,
    );
    if (Math.abs(px) > WALL_LIMIT || Math.abs(pz) > WALL_LIMIT) {
      targetHeading = Math.atan2(-px, -pz);
    }
    targetHeading = blendNeighborAvoidance(
      px,
      pz,
      targetHeading,
      spec.id,
      delta,
    );

    const err = signedAngleDiff(heading.current, targetHeading);
    const turnFactor = Math.min(1, Math.abs(err) / (Math.PI / 2));
    const boostRate = turnFactor > turnBoost.current ? BOOST_RISE : BOOST_FALL;
    turnBoost.current = THREE.MathUtils.lerp(
      turnBoost.current,
      turnFactor,
      Math.min(1, delta * boostRate),
    );

    const speed = swimSpeed.current * (1 + TURN_SPEED_BOOST * turnBoost.current);
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
    setKoiSchoolPosition(spec.id, rig.position.x, rig.position.z);

    const swim = swimActionRef.current;
    if (swim) {
      const base = BASE_SWIM_SPEED * speedScale;
      const target = THREE.MathUtils.clamp(
        ANIM_BASE_TIMESCALE * (speed / base),
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

/** Pond population — edit `koiSchoolConfig.ts` for Gumroad buyers. */
export function BlackWaterKoiFish() {
  return (
    <>
      {KOI_SCHOOL.map((spec) => (
        <KoiSwimmer key={spec.id} spec={spec} />
      ))}
    </>
  );
}

useGLTF.preload(KOI_PATH);
for (const spec of KOI_SCHOOL) {
  useTexture.preload(spec.diffuse);
}
