import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabasePromise } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper function to get auth headers for both Supabase and Replit auth
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  
  try {
    const supabase = await supabasePromise;
    
    // Only proceed if Supabase client was successfully created
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
  } catch (error) {
    // Supabase auth not available or failed, will rely on cookies
    console.debug('Supabase auth not available, using cookie auth');
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const contentHeaders = data ? { "Content-Type": "application/json" } : {};
  
  const res = await fetch(url, {
    method,
    headers: { ...contentHeaders, ...authHeaders },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Only use the first element as the URL, ignore additional parameters
    const url = queryKey[0] as string;
    const authHeaders = await getAuthHeaders();
    
    const res = await fetch(url, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5000, // 5 seconds stale time to allow auth state updates
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
