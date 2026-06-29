const ACCESS_KEY = 'cw_access_token';
const REFRESH_KEY = 'cw_refresh_token';

// Fired whenever the access token changes (login, silent refresh, logout) so
// the React auth context can re-derive state instead of going stale.
export const ACCESS_TOKEN_CHANGED = 'cw:access-token-changed';

function emitAccessChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACCESS_TOKEN_CHANGED));
  }
}

export const storage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  setAccess: (t: string) => {
    localStorage.setItem(ACCESS_KEY, t);
    emitAccessChanged();
  },
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    emitAccessChanged();
  },
};
