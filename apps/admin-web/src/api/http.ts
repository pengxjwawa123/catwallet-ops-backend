import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import { storage } from '@/utils/storage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export const http = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let queue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  queue.forEach((item) => {
    if (error) item.reject(error);
    else item.resolve(token!);
  });
  queue = [];
}

// Request interceptor: attach Bearer token
http.interceptors.request.use((config) => {
  const token = storage.getAccess();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap .data, handle 401 refresh
http.interceptors.response.use(
  (response) => {
    // Unwrap unified response envelope { data, timestamp }
    const body = response.data;
    if (body && typeof body === 'object' && 'data' in body && 'timestamp' in body) {
      return body.data;
    }
    return body;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = storage.getRefresh();
      if (!refreshToken) {
        storage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers!['Authorization'] = `Bearer ${token}`;
          return http(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
        const body = resp.data;
        // Unwrap envelope if needed
        const tokens = body?.data ?? body;
        const newAccess: string = tokens.accessToken;
        const newRefresh: string = tokens.refreshToken;
        storage.setAccess(newAccess);
        storage.setRefresh(newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers!['Authorization'] = `Bearer ${newAccess}`;
        return http(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        storage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Show error message
    const data = error.response?.data as { message?: string; code?: string } | undefined;
    const msg = data?.message ?? error.message ?? 'Request failed';
    if (error.response?.status !== 401) {
      message.error(msg);
    }

    return Promise.reject(error);
  },
);

export default http;
