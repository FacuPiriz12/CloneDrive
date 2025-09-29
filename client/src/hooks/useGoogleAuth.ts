import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

export interface GoogleAuthStatus {
  connected: boolean;
  hasValidToken: boolean;
}

export function useGoogleAuth() {
  const queryClient = useQueryClient();

  // Get Google auth status
  const {
    data: status,
    isLoading: isLoadingStatus,
    error: statusError
  } = useQuery<GoogleAuthStatus>({
    queryKey: ["/api/auth/google/status"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null on 401 instead of throwing
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: true, // Always enabled to check Google auth status
  });

  // Connect Google Drive mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      // This will redirect to Google OAuth
      window.location.href = "/api/auth/google";
    },
    onError: (error) => {
      console.error("Failed to start Google OAuth:", error);
    },
  });

  // Disconnect Google Drive mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/google", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google/status"] });
    },
    onError: (error) => {
      console.error("Failed to disconnect Google account:", error);
    },
  });

  // Check for OAuth callback result in URL
  const checkOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuth = urlParams.get('google_auth');
    
    if (googleAuth === 'success') {
      // Remove the parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('google_auth');
      window.history.replaceState({}, document.title, url.toString());
      
      // Refetch status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google/status"] });
      
      return { success: true };
    } else if (googleAuth === 'error') {
      // Remove the parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('google_auth');
      window.history.replaceState({}, document.title, url.toString());
      
      return { error: true };
    }
    
    return null;
  };

  return {
    status,
    isLoadingStatus,
    statusError,
    isConnected: status?.connected || false,
    hasValidToken: status?.hasValidToken || false,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    checkOAuthCallback,
  };
}