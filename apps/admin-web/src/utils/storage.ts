const ACCESS_KEY = 'cw_access_token';
const REFRESH_KEY = 'cw_refresh_token';

export const storage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  setAccess: (t: string) => localStorage.setItem(ACCESS_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
