import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function readErrorMessage(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (typeof data?.message === "string" && data.message.trim()) {
        return data.message;
      }
      return JSON.stringify(data);
    } catch {
      return res.statusText;
    }
  }

  const text = (await res.text()).trim();
  return text || res.statusText;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(`${res.status}: ${message}`);
  }
}

export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = (await res.text()).trim();
  if (!text) {
    throw new Error("The server returned an empty response.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const hasData = data !== undefined && data !== null;
  const isFormData = data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    // Don't set Content-Type for FormData - browser will set it with boundary
    headers: hasData && !isFormData ? { "Content-Type": "application/json" } : {},
    body: hasData ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>(options: { on401: "returnNull" }): QueryFunction<T | null>;
export function getQueryFn<T>(options: { on401: "throw" }): QueryFunction<T>;
export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }) {
  const { on401: unauthorizedBehavior } = options;

  return async ({ queryKey }: Parameters<QueryFunction<T | null>>[0]) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await readJsonResponse(res);
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
