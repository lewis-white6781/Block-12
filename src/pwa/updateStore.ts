// Update state — SPEC-V3.0.md section 5.
//
// Non-persisted, kept separate from useStore so the domain store stays purely
// about training data — the same split src/sync/syncStore.ts already uses for
// network state.
import { create } from 'zustand';

export type UpdatePhase =
  /** No newer build seen. */
  | 'current'
  /** A new worker has installed and is waiting; the page decides when to swap. */
  | 'ready'
  /** SKIP_WAITING sent, reload imminent. */
  | 'applying';

interface UpdateState {
  phase: UpdatePhase;
  /** The version this page is running, for the About card and the post-update toast. */
  version: string;
  buildId: string;
  /** Set on the first load after a version change, cleared once shown. */
  justUpdatedFrom: string | null;
  setReady: () => void;
  setApplying: () => void;
  setJustUpdatedFrom: (previous: string | null) => void;
  clearJustUpdated: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  phase: 'current',
  version: __APP_VERSION__,
  buildId: __BUILD_ID__,
  justUpdatedFrom: null,
  setReady: () => set({ phase: 'ready' }),
  setApplying: () => set({ phase: 'applying' }),
  setJustUpdatedFrom: (previous) => set({ justUpdatedFrom: previous }),
  clearJustUpdated: () => set({ justUpdatedFrom: null }),
}));
