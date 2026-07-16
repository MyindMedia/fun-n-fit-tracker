// Test storage access via public URLs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odsyoxopcvtgxylmnapk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kc3lveG9wY3Z0Z3h5bG1uYXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTk1ODUsImV4cCI6MjA4MTk5NTU4NX0.zUaaMN52LZTivr6h-aKyBTQTKD0EFbypV58S5vttmVk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testStorageAccess() {
  console.log('\n🔍 Testing Storage Access...\n');

  // List files in team folder
  console.log('📁 Checking team/ folder:');
  const { data: teamFiles, error: teamError } = await supabase.storage
    .from('Assets')
    .list('team');

  if (teamError) {
    console.log('  ❌ Error:', teamError.message);
  } else {
    console.log(`  ✅ Found ${teamFiles.length} files`);
    teamFiles.forEach(f => console.log(`     - ${f.name}`));
  }

  // List files in levels folder
  console.log('\n📁 Checking levels/ folder:');
  const { data: levelFiles, error: levelError } = await supabase.storage
    .from('Assets')
    .list('levels');

  if (levelError) {
    console.log('  ❌ Error:', levelError.message);
  } else {
    console.log(`  ✅ Found ${levelFiles.length} files`);
    levelFiles.forEach(f => console.log(`     - ${f.name}`));
  }

  // Test public URL access
  console.log('\n🔗 Testing Public URL Generation:');
  const testUrl = supabase.storage.from('Assets').getPublicUrl('team/unity.png');
  console.log(`  Unity Icon: ${testUrl.data.publicUrl}`);

  console.log('\n✅ Done!\n');
}

testStorageAccess();
