import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'students' });
    if (error) {
        // Fallback: raw SQL query
        console.log("RPC failed, fetching from pg_policies...");
    } else {
        console.log(data);
    }
}
checkPolicies();
