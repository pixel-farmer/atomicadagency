'use client';

import { TheRoomGrade } from '@/components/assists/the-room/TheRoomAtmosphere';
import { FirstPersonControls } from '@/components/assists/the-room/TheRoomScene';
import { LinePrinter } from '@/components/assists/the-room/server/LinePrinter';
import { ServerCabinet } from '@/components/assists/the-room/server/ServerCabinet';
import { ServerRoomDriver } from '@/components/assists/the-room/server/ServerRoomDriver';
import { ServerRoomShell } from '@/components/assists/the-room/server/ServerRoomShell';
import { OpsWall } from '@/components/assists/the-room/server/OpsWall';
import { WallFocus } from '@/components/assists/the-room/server/WallFocus';
import { cameraHold } from '@/components/assists/the-room/server/serverStore';
import {
  EYE_HEIGHT,
  MACHINES,
  OBSTACLES,
  SERVER_ROOM,
  START_POSITION,
} from '@/components/assists/the-room/server/serverRoomConfig';

/** The retro server room: grayscale, glossy tiles, every machine fed by live Wikipedia edits. */
export function ServerRoomScene() {
  return (
    <>
      <ServerRoomShell />
      {MACHINES.map((spec) =>
        spec.kind === 'printer' ? <LinePrinter key={spec.id} spec={spec} /> : <ServerCabinet key={spec.id} spec={spec} />,
      )}
      <OpsWall />
      <ServerRoomDriver />
      <WallFocus />
      <FirstPersonControls
        start={START_POSITION}
        eyeHeight={EYE_HEIGHT}
        bounds={SERVER_ROOM}
        obstacles={OBSTACLES}
        hold={cameraHold}
      />
      <TheRoomGrade />
    </>
  );
}
