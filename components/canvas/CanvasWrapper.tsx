'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { CanvasFallback } from './CanvasFallback';
import type { InnerCanvasProps } from './InnerCanvas';

const DynamicInnerCanvas = dynamic(
  () => import('./InnerCanvas').then((mod) => mod.InnerCanvas),
  {
    ssr: false,
    loading: () => <CanvasFallback />,
  },
);

export type CanvasWrapperProps = {
  /** Scene graph passed into the R3F Canvas */
  children?: ReactNode;
  /** Wrapper around the canvas (layout / aspect ratio) */
  wrapperClassName?: string;
  /** Props forwarded to the client-only Canvas */
  canvasClassName?: InnerCanvasProps['className'];
  cameraPosition?: InnerCanvasProps['cameraPosition'];
  cameraFov?: InnerCanvasProps['cameraFov'];
  dpr?: InnerCanvasProps['dpr'];
  shadows?: InnerCanvasProps['shadows'];
};

const defaultProps = {
  wrapperClassName: 'relative h-[min(52vh,520px)] w-full overflow-hidden rounded-xl',
  canvasClassName: 'h-full w-full',
  cameraPosition: [0, 0, 5] as [number, number, number],
  cameraFov: 45,
  dpr: [1, 2] as [number, number],
  shadows: false,
} satisfies Omit<CanvasWrapperProps, 'children'>;

export function CanvasWrapper({
  children,
  wrapperClassName = defaultProps.wrapperClassName,
  canvasClassName = defaultProps.canvasClassName,
  cameraPosition = defaultProps.cameraPosition,
  cameraFov = defaultProps.cameraFov,
  dpr = defaultProps.dpr,
  shadows = defaultProps.shadows,
}: CanvasWrapperProps) {
  return (
    <div className={wrapperClassName}>
      <DynamicInnerCanvas
        className={canvasClassName}
        cameraPosition={cameraPosition}
        cameraFov={cameraFov}
        dpr={dpr}
        shadows={shadows}
      >
        {children}
      </DynamicInnerCanvas>
    </div>
  );
}
