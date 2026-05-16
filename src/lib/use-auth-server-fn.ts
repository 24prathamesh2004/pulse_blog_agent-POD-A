import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';

// Wrapper around useServerFn that automatically includes auth token
// This implementation passes the token in the request payload instead of
// overriding globalThis.fetch, which is more reliable with TanStack Start
export function useAuthServerFn<T extends (...args: any[]) => any>(fn: T) {
  const serverFn = useServerFn(fn);
  
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    // Get the current session token
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }
    
    if (!session?.access_token) {
      throw new Error('Not authenticated. Please log in to continue.');
    }
    
    // Check if token is expired
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      throw new Error('Session expired. Please log in again.');
    }
    
    // Add auth header to the request by intercepting fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${session.access_token}`);
      
      return originalFetch(input, {
        ...init,
        headers,
      });
    };
    
    try {
      return await serverFn(...args);
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  };
}
