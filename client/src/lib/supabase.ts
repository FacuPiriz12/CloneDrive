import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials from server endpoint
async function getSupabaseConfig() {
  try {
    const response = await fetch('/api/config/supabase');
    if (!response.ok) {
      throw new Error('Failed to fetch Supabase config');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Supabase config:', error);
    throw error;
  }
}

// Create Supabase client with config from server
export async function createSupabaseClient() {
  const config = await getSupabaseConfig();
  
  if (!config.url || !config.anonKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

// Export a promise that resolves to the supabase client
export const supabasePromise = createSupabaseClient();