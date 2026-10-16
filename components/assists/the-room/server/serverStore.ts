import { useSyncExternalStore } from 'react';

/**
 * A tiny external store. The canvas writes to these every few frames and the DOM HUD reads them,
 * so neither side re-renders the other.
 */
export type Store<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Id of the machine in the middle of the view, close enough to read. */
export const hudFocus = createStore<string | null>(null);
/** Text of the red alert while it is showing. */
export const hudAlert = createStore<string | null>(null);
