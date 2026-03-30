import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn, readJsonResponse } from "@/lib/queryClient";

export type AuthUser = {
  id: string;
  username: string;
  isGuest: boolean;
  canChangePassword: boolean;
  mustChangePassword: boolean;
};

type AuthResponse = {
  user: AuthUser;
  defaultPassword?: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  defaultPassword: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<AuthUser>;
  refresh: () => Promise<AuthResponse | null | undefined>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const authQuery = useQuery<AuthResponse | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn<AuthResponse | null>({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await apiRequest("POST", "/api/auth/login", input);
      return await readJsonResponse<AuthResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const response = await apiRequest("POST", "/api/auth/change-password", input);
      return await readJsonResponse<AuthResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], {
        ...(authQuery.data ?? {}),
        ...data,
      });
    },
  });

  const value: AuthContextValue = {
    user: authQuery.data?.user ?? null,
    defaultPassword: authQuery.data?.defaultPassword ?? null,
    isLoading: authQuery.isLoading,
    isAuthenticated: Boolean(authQuery.data?.user),
    login: async (input) => (await loginMutation.mutateAsync(input)).user,
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    changePassword: async (input) => (await changePasswordMutation.mutateAsync(input)).user,
    refresh: async () => queryClient.fetchQuery({
      queryKey: ["/api/auth/me"],
      queryFn: getQueryFn<AuthResponse | null>({ on401: "returnNull" }),
    }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
