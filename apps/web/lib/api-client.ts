import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

// When served by the API (NestJS ServeStatic) the FE and API share the same
// origin, so a relative "/api/v1" base is enough and avoids CORS entirely.
// A remote API can still be targeted via NEXT_PUBLIC_API_URL (e.g. dev server
// against a hosted backend).
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// SECURITY TRADE-OFF (Phase 1 MVP):
// We store both access + refresh tokens in localStorage for simplicity. This is
// vulnerable to XSS. Production should:
//   - keep refresh token in an httpOnly, Secure, SameSite=Strict cookie
//   - keep access token only in memory
// Tracked for Phase 2 hardening.
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
  // Strip params có value "" / null / undefined trước khi serialize thành query.
  // Backend dùng `forbidNonWhitelisted: true` + `@IsISO8601()` → nhận empty
  // string sẽ trả 400 (case /purchases?fromDate=&toDate=).
  if (config.params && typeof config.params === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
    }
    config.params = cleaned;
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
        const payload = data?.data ?? data;
        const access = payload?.accessToken;
        const newRefresh = payload?.refreshToken;
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
