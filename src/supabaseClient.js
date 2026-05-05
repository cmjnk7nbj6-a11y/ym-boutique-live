import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);
export const productBucket = import.meta.env.VITE_SUPABASE_PRODUCT_BUCKET || 'product-images';

export const supabase = supabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;
