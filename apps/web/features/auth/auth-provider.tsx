"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient, setTokens, clearTokens } from "@/lib/api-client";

export interface AuthRole {
  id: string;
  code: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: AuthRole[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  roles: AuthRole[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const PUBLIC_ROUTES = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchMe = React.useCallback(async () => {
    try {
      const { data } = await apiClient.get("/auth/me");
      const payload = data?.data ?? data;
      setUser(payload as AuthUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("refurb.access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    void fetchMe();
  }, [fetchMe]);

  React.useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, isLoading, pathname, router]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post("/auth/login", { email, password });
      const payload = data?.data ?? data;
      const access = payload.accessToken ?? payload.access_token;
      const refresh = payload.refreshToken ?? payload.refresh_token;
      if (!access || !refresh) {
        throw new Error("Phản hồi đăng nhập không hợp lệ");
      }
      setTokens(access, refresh);
      await fetchMe();
    },
    [fetchMe],
  );

  const logout = React.useCallback(() => {
    clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      permissions: user?.permissions ?? [],
      roles: user?.roles ?? [],
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used inside AuthProvider");
  }
  return ctx;
}
