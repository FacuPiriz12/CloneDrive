import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { supabasePromise } from "@/lib/supabase";
import { useEffect, useState } from "react";

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    name?: string;
    avatar_url?: string;
  };
};

export function useAuth() {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(true);
  const queryClient = useQueryClient();

  // Initialize Supabase auth listener
  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;
    
    const initSupabaseAuth = async () => {
      try {
        const supabase = await supabasePromise;
        
        // Only proceed if Supabase credentials are configured
        if (!supabase) {
          if (mounted) {
            setIsSupabaseLoading(false);
          }
          return;
        }
        
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSupabaseUser(session?.user || null);
          setIsSupabaseLoading(false);
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (mounted) {
              setSupabaseUser(session?.user || null);
              // Invalidate and refetch user data when auth state changes
              queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            }
          }
        );

        cleanup = () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing Supabase auth:', error);
        if (mounted) {
          setIsSupabaseLoading(false);
        }
      }
    };

    initSupabaseAuth();
    
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);

  // Query for backend user data
  const { data: backendUser, isLoading: isBackendLoading, error, isError } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async ({ queryKey }) => {
      // If we have a Supabase user, include the auth token
      if (supabaseUser) {
        const supabase = await supabasePromise;
        
        // Only proceed if Supabase client exists
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.access_token) {
            const response = await fetch("/api/auth/user", {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            if (!response.ok) {
              if (response.status === 401) return null;
              throw new Error('Failed to fetch user');
            }
            
            return response.json();
          }
        }
      }
      
      // Fallback to regular query function (for Replit auth or dev mode)
      return getQueryFn({ on401: "returnNull" })({ queryKey });
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Always refetch on mount to catch new auth sessions
    staleTime: 0, // Don't use stale data
    gcTime: 0, // Don't keep data in cache
    enabled: !isSupabaseLoading, // Only run when Supabase auth is initialized
  });

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      // Sign out from Supabase if user is using Supabase auth
      if (supabaseUser) {
        const supabase = await supabasePromise;
        await supabase.auth.signOut();
      } else {
        // Sign out from Replit/dev auth
        const response = await fetch('/api/logout', { method: 'POST' });
        if (!response.ok) {
          throw new Error('Failed to sign out');
        }
      }
    },
    onSuccess: () => {
      queryClient.clear();
      setSupabaseUser(null);
    },
  });

  const isLoading = isSupabaseLoading || isBackendLoading;
  const user = backendUser;
  const isAuthenticated = !!(supabaseUser || (user && !isError));
  
  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    signOut: signOutMutation.mutate,
    isSigningOut: signOutMutation.isPending,
  };
}
