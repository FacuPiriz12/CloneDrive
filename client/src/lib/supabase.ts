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
  try {
    const config = await getSupabaseConfig();
    
    if (!config.url || !config.anonKey) {
      console.log('Supabase not configured, falling back to Replit Auth');
      return null;
    }

    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    console.log('Supabase initialization failed, using Replit Auth only');
    return null;
  }
}

// Export a promise that resolves to the supabase client or null
export const supabasePromise = createSupabaseClient();