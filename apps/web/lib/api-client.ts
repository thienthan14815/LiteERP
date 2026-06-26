import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

const ACCESS_TOKEN_KEY = "refurb.access_token";
const REFRESH_TOKEN_KEY = "refurb.refresh_token";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  timeout: 20_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Refresh-token rotation stub ----
// Phase 1 implements actual refresh. For now we just clear tokens on 401.
let isRefreshing = false;
let queuedRequests: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  queuedRequests.forEach((cb) => cb(token));
  queuedRequests = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      getRefreshToken()
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queuedRequests.push((token) => {
            if (!token) {
              reject(error);
              return;
            }
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refresh = getRefreshToken();
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: refresh,
        });
        const access = data?.data?.accessToken;
        const newRefresh = data?.data?.refreshToken;
        if (access && newRefresh) {
          setTokens(access, newRefresh);
          flushQueue(access);
          original.headers.Authorization = `Bearer ${access}`;
          return apiClient(original);
        }
        flushQueue(null);
        clearTokens();
      } catch (e) {
        flushQueue(null);
        clearTokens();
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
