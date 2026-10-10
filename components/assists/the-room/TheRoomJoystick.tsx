'use client';

import { useEffect, useRef, useState } from 'react';
import { roomTouchInput } from '@/components/assists/the-room/theRoomPuzzle';

const PAD_SIZE = 112;
const KNOB_SIZE = 44;
const TRAVEL = (PAD_SIZE - KNOB_SIZE) / 2;

/** Thumb joystick for walking on touch screens; dragging anywhere else still looks around. */
export function TheRoomJoystick({ className = '' }: { className?: string }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(
    () => () => {
      roomTouchInput.x = 0;
      roomTouchInput.y = 0;
    },
    [],
  );

  const update = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > TRAVEL) {
      dx = (dx / len) * TRAVEL;
      dy = (dy / len) * TRAVEL;
    }
    setKnob({ x: dx, y: dy });
    roomTouchInput.x = dx / TRAVEL;
    roomTouchInput.y = -dy / TRAVEL;
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    roomTouchInput.x = 0;
    roomTouchInput.y = 0;
  };

  return (
    <div
      ref={padRef}
      className={`pointer-events-auto touch-none rounded-full border border-[#404040]/25 bg-white/10 ${className}`}
      style={{ width: PAD_SIZE, height: PAD_SIZE }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="pointer-events-none absolute rounded-full bg-[#404040]/30"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: (PAD_SIZE - KNOB_SIZE) / 2 + knob.x,
          top: (PAD_SIZE - KNOB_SIZE) / 2 + knob.y,
        }}
      />
    </div>
  );
}
