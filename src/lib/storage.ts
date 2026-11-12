import type { AppState } from '../types/state';

export const CACHE_KEY = 'duitku_cache_v2';

export function loadFromLocalCache(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached && typeof cached === 'object') {
      return cached;
    }
  } catch (e) {
    console.warn('Gagal membaca cache lokal:', e);
  }
  return null;
}

export function saveToLocalCache(state: AppState): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        acc: state.acc,
        tx: state.tx,
        inst: state.inst,
        sav: state.sav,
        mv: state.mv,
        bud: state.bud,
        rec: state.rec,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('Gagal menyimpan cache lokal:', e);
  }
}
