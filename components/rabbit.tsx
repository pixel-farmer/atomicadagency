'use client';

import * as THREE from 'three';
import { Clone, useAnimations, useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Box3, Group, Object3D, Vector3 } from 'three';

const RABBIT_TARGET_HEIGHT = 2.1;
/** Yaw toward viewer’s left (radians). */
const RABBIT_YAW_LEFT = -0.28;

function uniformScaleForHeight(root: Object3D, targetHeight: number) {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  return targetHeight / Math.max(size.y, 0.001);
}

export default function Rabbit({ z = 0 }: { z?: number }) {
  const rigRef = useRef<Group>(null);
  const { scene, animations } = useGLTF('/rabbit.glb');

  const { scale, floorY } = useMemo(() => {
    const scale = uniformScaleForHeight(scene, RABBIT_TARGET_HEIGHT);
    const box = new Box3().setFromObject(scene);
    const floorY = -box.min.y * scale;
    return { scale, floorY };
  }, [scene]);

  const { actions } = useAnimations(animations, rigRef);

  useLayoutEffect(() => {
    const wiggleA = actions.EarWiggleA;
    const wiggleB = actions.EarWiggleB;

    if (!wiggleA || !wiggleB) return;

    wiggleA.setLoop(THREE.LoopOnce, 1);
    wiggleA.clampWhenFinished = true;

    wiggleB.setLoop(THREE.LoopOnce, 1);
    wiggleB.clampWhenFinished = true;

    let timeout: ReturnType<typeof setTimeout>;

    const playRandomWiggle = () => {
      wiggleA.stop();
      wiggleB.stop();

      const wiggle = Math.random() > 0.5 ? wiggleA : wiggleB;
      wiggle.reset().fadeIn(0.1).play();

      const duration = wiggle.getClip().duration * 1000;
      const nextDelay = duration + 2000 + Math.random() * 3000;

      timeout = setTimeout(playRandomWiggle, nextDelay);
    };

    playRandomWiggle();

    return () => {
      clearTimeout(timeout);
      wiggleA.stop();
      wiggleB.stop();
    };
  }, [actions, scene]);

  return (
    <group
      ref={rigRef}
      position={[0, floorY, z]}
      rotation={[0, RABBIT_YAW_LEFT, 0]}
      scale={scale}
    >
      <Clone object={scene} deep castShadow receiveShadow />
    </group>
  );
}

useGLTF.preload('/rabbit.glb');
