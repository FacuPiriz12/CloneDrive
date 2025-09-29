import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error, isError } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null on 401 instead of throwing
    retry: false,
    refetchOnWindowFocus: false, // Don't refetch on focus to avoid loops
    staleTime: 1000, // 1 second stale time
    refetchInterval: false, // Don't auto-refetch
  });

  // User is authenticated ONLY if we have valid user data
  // If we get null (from 401) or error, user is not authenticated
  const isAuthenticated = !!user && !isError;
  
  return {
    user,
    isLoading,
    isAuthenticated,
    error,
  };
}
