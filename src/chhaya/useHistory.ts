"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SETTLE_MS = 350;
const LIMIT = 100;

/**
 * Undo/redo for plain values.
 * `set` is for live changes (slider drags): it shows immediately and becomes
 * one history step once it settles. `push` records a step right away.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<{ stack: T[]; i: number }>({ stack: [initial], i: 0 });
  const [draft, setDraft] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((v: T) => {
    setState(({ stack, i }) => {
      const next = [...stack.slice(0, i + 1), v].slice(-LIMIT);
      return { stack: next, i: next.length - 1 };
    });
    setDraft(null);
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const set = useCallback(
    (v: T) => {
      setDraft(v);
      flush();
      timer.current = setTimeout(() => commit(v), SETTLE_MS);
    },
    [commit, flush],
  );

  const push = useCallback(
    (v: T) => {
      flush();
      commit(v);
    },
    [commit, flush],
  );

  // An unsettled draft counts as the newest step, so undo goes back past it.
  const undo = useCallback(() => {
    flush();
    if (draft !== null) {
      setDraft(null);
      return;
    }
    setState((s) => ({ ...s, i: Math.max(0, s.i - 1) }));
  }, [draft, flush]);

  const redo = useCallback(() => {
    flush();
    setDraft(null);
    setState((s) => ({ ...s, i: Math.min(s.stack.length - 1, s.i + 1) }));
  }, [flush]);

  useEffect(() => flush, [flush]);

  const value = draft ?? state.stack[state.i];
  return useMemo(
    () => ({
      value,
      set,
      push,
      undo,
      redo,
      canUndo: draft !== null || state.i > 0,
      canRedo: draft === null && state.i < state.stack.length - 1,
    }),
    [value, set, push, undo, redo, draft, state],
  );
}
