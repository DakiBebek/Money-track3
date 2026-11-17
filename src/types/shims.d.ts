declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module '@supabase/supabase-js' {
  export interface AuthChangeEvent {
    (event: string, session: any): void;
  }

  export interface SupabaseClient {
    auth: any;
    from: (table: string) => any;
    storage: any;
  }

  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): SupabaseClient;
}
