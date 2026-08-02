// Non-persisted sync status — kept separate from useStore so the main
// domain store stays purely about training data, not network state.
import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  setSyncing: () => void;
  setSynced: () => void;
  setError: (message: string) => void;
  setOffline: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
  setSyncing: () => set({ status: 'syncing', lastError: null }),
  setSynced: () => set({ status: 'idle', lastSyncedAt: new Date().toISOString(), lastError: null }),
  setError: (message) => set({ status: 'error', lastError: message }),
  setOffline: () => set({ status: 'offline', lastError: null }),
}));
