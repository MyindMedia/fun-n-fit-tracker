// Quick Supabase verification script
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odsyoxopcvtgxylmnapk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kc3lveG9wY3Z0Z3h5bG1uYXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTk1ODUsImV4cCI6MjA4MTk5NTU4NX0.zUaaMN52LZTivr6h-aKyBTQTKD0EFbypV58S5vttmVk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifySetup() {
  console.log('\n🔍 Verifying Supabase Setup...\n');

  const tables = [
    'students',
    'game_sessions',
    'transactions',
    'notifications',
    'game_library',
    'badges',
    'rewards',
    'ranks',
    'app_settings'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // Check storage bucket
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const assetsBucket = buckets?.find(b => b.name === 'Assets');
    if (assetsBucket) {
      console.log(`\n✅ Storage bucket 'Assets': ${assetsBucket.public ? 'PUBLIC' : 'PRIVATE'}`);
    } else {
      console.log('\n⚠️  Storage bucket \'Assets\' not found');
    }
  } catch (err) {
    console.log('\n❌ Storage check failed:', err.message);
  }

  console.log('\n✅ Verification complete!\n');
}

verifySetup();
