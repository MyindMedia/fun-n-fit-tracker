import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://odsyoxopcvtgxylmnapk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kc3lveG9wY3Z0Z3h5bG1uYXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTk1ODUsImV4cCI6MjA4MTk5NTU4NX0.zUaaMN52LZTivr6h-aKyBTQTKD0EFbypV58S5vttmVk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLinks() {
    console.log("Testing join on parent_student_links...");
    const { data: linkData, error: linkError } = await supabase
        .from('parent_student_links')
        .select(`
          parent_id,
          student_id,
          students(*)
        `)
        .limit(1);

    if (linkError) {
        console.error("Link Select Error:", linkError);
    } else {
        console.log("Success! Data:", JSON.stringify(linkData, null, 2));
    }
}
testLinks();
