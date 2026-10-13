'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

type PreviewState = {
  /** Hover-capable pointer and no reduced-motion preference. */
  enabled: boolean;
  activeSlug: string | null;
  activate: (slug: string) => void;
  deactivate: (slug: string) => void;
  release: (slug: string) => void;
  trackRef: RefObject<HTMLElement | null>;
  setTrack: (element: HTMLElement | null) => void;
};

const PreviewContext = createContext<PreviewState | null>(null);

export function PreviewProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const trackRef = useRef<HTMLElement | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const setTrack = useCallback((element: HTMLElement | null) => {
    trackRef.current = element;
  }, []);

  const activate = useCallback((slug: string) => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setActiveSlug(slug);
  }, []);

  const deactivate = useCallback((slug: string) => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      setActiveSlug((current) => (current === slug ? null : current));
    }, 300);
  }, []);

  const release = useCallback((slug: string) => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setActiveSlug((current) => (current === slug ? null : current));
  }, []);

  const value = useMemo(
    () => ({ enabled, activeSlug, activate, deactivate, release, trackRef, setTrack }),
    [enabled, activeSlug, activate, deactivate, release, setTrack],
  );

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  const value = useContext(PreviewContext);
  if (!value) {
    throw new Error('usePreview must be used inside PreviewProvider');
  }
  return value;
}
