'use client';

import { Clone, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Box3, Group, Object3D, Vector3 } from 'three';

const KOI_PATH = '/koi_fish_bw.glb';
/** Target body length in world units (water plane is 24). */
const KOI_TARGET_LENGTH = 2.8;
/** World Y of the water surface (matches flat water plane). */
const WATER_Y = 0;
const SWIM_DEPTH = 0.62;

const POND_HALF = 5;
const WAYPOINT_ARRIVE = 0.45;
const MIN_WAYPOINT_DIST = 1.35;
/** Max turn rate (radians / sec) toward waypoint heading. */
const TURN_RATE = 0.50;
const BASE_SWIM_SPEED = 0.48;

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

function applyUnderwaterMaterial(root: Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.setRGB(0.12, 0.13, 0.17);
        mat.emissive.setRGB(0.015, 0.02, 0.03);
        mat.metalness = 0.08;
        mat.roughness = 0.92;
      } else if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.setRGB(0.14, 0.15, 0.19);
      }
    }
  });
}

function pickSwimAction(actions: Record<string, THREE.AnimationAction | null | undefined>) {
  const names = ['Swim', 'swim', 'Swimming', 'Idle', 'idle', 'ArmatureAction', 'Animation'];
  for (const name of names) {
    if (actions[name]) return actions[name];
  }
  return Object.values(actions).find(Boolean);
}

function lerpAngle(current: number, target: number, t: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

function pickWaypoint(
  from: Vector3,
  forwardX: number,
  forwardZ: number,
): Vector3 {
  for (let attempt = 0; attempt < 16; attempt++) {
    const wx = (Math.random() * 2 - 1) * POND_HALF;
    const wz = (Math.random() * 2 - 1) * POND_HALF;
    const dx = wx - from.x;
    const dz = wz - from.z;
    const len = Math.hypot(dx, dz);
    if (len < MIN_WAYPOINT_DIST) continue;

    const ndx = dx / len;
    const ndz = dz / len;
    const dot = ndx * forwardX + ndz * forwardZ;
    if (dot < -0.2) continue;

    return new Vector3(wx, from.y, wz);
  }

  const angle = Math.random() * Math.PI * 2;
  return new Vector3(
    from.x + Math.sin(angle) * MIN_WAYPOINT_DIST,
    from.y,
    from.z + Math.cos(angle) * MIN_WAYPOINT_DIST,
  );
}

export function BlackWaterKoiFish() {
  const rigRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(KOI_PATH);

  const waypoint = useRef(new Vector3());
  const heading = useRef(0);
  const swimSpeed = useRef(BASE_SWIM_SPEED);
  const targetSwimSpeed = useRef(BASE_SWIM_SPEED);
  const movementReady = useRef(false);
  const nextSpeedChangeAt = useRef(0);

  const { scale, depthOffset } = useMemo(() => {
    const s = scaleToLength(scene, KOI_TARGET_LENGTH);
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    return { scale: s, depthOffset: -center.y * s };
  }, [scene]);

  const { actions } = useAnimations(animations, rigRef);

  useLayoutEffect(() => {
    applyUnderwaterMaterial(scene);
  }, [scene]);

  useLayoutEffect(() => {
    const swim = pickSwimAction(actions);
    if (!swim) return;

    swim.reset().fadeIn(0.4).setLoop(THREE.LoopRepeat, Infinity).play();
    swim.timeScale = 0.85;

    return () => {
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

    const fx = Math.sin(heading.current);
    const fz = Math.cos(heading.current);
    waypoint.current.copy(pickWaypoint(rig.position, fx, fz));
    movementReady.current = true;
  }, [depthOffset]);

  useFrame((state, delta) => {
    const rig = rigRef.current;
    if (!rig || !movementReady.current) return;

    const t = state.clock.elapsedTime;
    const swimY = WATER_Y - SWIM_DEPTH + depthOffset + Math.sin(t * 0.75) * 0.06;

    if (t >= nextSpeedChangeAt.current) {
      targetSwimSpeed.current = BASE_SWIM_SPEED + (Math.random() - 0.5) * 0.14;
      nextSpeedChangeAt.current = t + 2.5 + Math.random() * 2.5;
    }
    swimSpeed.current = THREE.MathUtils.lerp(
      swimSpeed.current,
      targetSwimSpeed.current,
      Math.min(1, delta * 0.35),
    );

    const px = rig.position.x;
    const pz = rig.position.z;
    let toX = waypoint.current.x - px;
    let toZ = waypoint.current.z - pz;
    let dist = Math.hypot(toX, toZ);

    if (dist < WAYPOINT_ARRIVE) {
      const fx = Math.sin(heading.current);
      const fz = Math.cos(heading.current);
      waypoint.current.copy(pickWaypoint(rig.position, fx, fz));
      toX = waypoint.current.x - px;
      toZ = waypoint.current.z - pz;
      dist = Math.hypot(toX, toZ);
    }

    const targetHeading = Math.atan2(toX, toZ);
    const turnStep = Math.min(1, delta * TURN_RATE);
    heading.current = lerpAngle(heading.current, targetHeading, turnStep);

    const step = swimSpeed.current * delta;
    rig.position.x += Math.sin(heading.current) * step;
    rig.position.z += Math.cos(heading.current) * step;
    rig.position.y = swimY;

    rig.position.x = THREE.MathUtils.clamp(rig.position.x, -POND_HALF, POND_HALF);
    rig.position.z = THREE.MathUtils.clamp(rig.position.z, -POND_HALF, POND_HALF);

    rig.rotation.set(0, heading.current, 0);
  });

  return (
    <group ref={rigRef} renderOrder={0}>
      <group rotation={PIVOT_ORIENTATION}>
        <Clone object={scene} deep scale={scale} />
      </group>
    </group>
  );
}

useGLTF.preload(KOI_PATH);
